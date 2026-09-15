const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const CITIES = [
  {
    cityTag: 'bangalore',
    districtId: 'dist-bengaluru-urban',
    name: 'Bengaluru',
    bbox: '12.86,77.50,13.06,77.72'
  },
  {
    cityTag: 'mumbai',
    districtId: 'dist-mumbai-suburban',
    name: 'Mumbai',
    bbox: '18.90,72.80,19.26,72.96'
  }
];

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineLength(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return total;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithFallback(query) {
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      console.log(`  Querying ${ep}...`);
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'UrbanEye/1.0',
          'Accept': 'application/json'
        },
        body: `data=${encodeURIComponent(query)}`
      });
      if (res.ok) {
        return await res.json();
      }
      console.warn(`  ${ep} returned HTTP ${res.status}`);
    } catch (e) {
      console.warn(`  ${ep} failed: ${e.message}`);
    }
  }
  return null;
}

async function ingestCity(city) {
  console.log(`\n📡 Fetching real road network for ${city.name} (BBOX: ${city.bbox})...`);
  const query = `[out:json][timeout:45][bbox:${city.bbox}];
(
  way["highway"="trunk"];
  way["highway"="primary"];
  way["highway"="secondary"];
  way["highway"="trunk_link"];
  way["highway"="primary_link"];
);
out body;
>;
out skel qt;
`;

  const data = await fetchWithFallback(query);
  if (!data || !data.elements) {
    console.error(`❌ Could not fetch data for ${city.name}`);
    return 0;
  }

  const nodeMap = new Map();
  const ways = [];
  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lat, el.lon]);
    } else if (el.type === 'way') {
      ways.push(el);
    }
  }

  console.log(`  Parsed ${nodeMap.size} nodes and ${ways.length} road ways for ${city.name}`);

  // Delete old coarse/fake demo segments for this city
  await prisma.roadSegment.deleteMany({
    where: { cityTag: city.cityTag }
  });

  let inserted = 0;
  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 2) continue;
    const coords = [];
    for (const nid of way.nodes) {
      const c = nodeMap.get(nid);
      if (c) coords.push(c);
    }
    if (coords.length < 2) continue;

    let roadClass = way.tags?.highway || 'secondary';
    if (roadClass.endsWith('_link')) roadClass = roadClass.replace('_link', '');

    let name = way.tags?.name || way.tags?.['name:en'] || way.tags?.ref || null;
    if (!name) {
      if (roadClass === 'trunk') name = `${city.name} Express Highway Corridor`;
      else if (roadClass === 'primary') name = `${city.name} Major Arterial Road`;
      else name = `${city.name} City Connector`;
    }

    const lengthM = Math.round(polylineLength(coords));
    if (lengthM < 40) continue;

    const osmWayId = `osm-${city.cityTag}-${way.id}`;
    try {
      await prisma.roadSegment.create({
        data: {
          osmWayId,
          name,
          roadClass,
          coordinates: JSON.stringify(coords),
          lengthM,
          cityTag: city.cityTag,
          districtId: city.districtId
        }
      });
      inserted++;
    } catch {
      // ignore
    }
  }

  console.log(`  ✅ Successfully saved ${inserted} real road segments for ${city.name}`);
  return inserted;
}

async function main() {
  // Clean up coarse national highway chords that cross cities as straight lines
  console.log('🧹 Cleaning up coarse national highway chords...');
  await prisma.roadSegment.deleteMany({
    where: { cityTag: 'national' }
  });

  for (const city of CITIES) {
    await ingestCity(city);
    await sleep(2000);
  }

  // Export updated road_segments.json
  console.log('\n💾 Exporting complete real road network to road_segments.json...');
  const allSegments = await prisma.roadSegment.findMany();
  const jsonPath = path.resolve(__dirname, '..', 'prisma', 'road_segments.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allSegments), 'utf8');
  console.log(`✅ Exported ${allSegments.length} real road segments to ${jsonPath}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
