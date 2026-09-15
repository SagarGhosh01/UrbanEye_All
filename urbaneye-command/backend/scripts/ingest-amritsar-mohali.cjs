const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CITIES = [
  {
    cityTag: 'amritsar',
    districtId: 'dist-amritsar',
    name: 'Amritsar',
    bbox: '31.58,74.82,31.70,74.95'
  },
  {
    cityTag: 'mohali',
    districtId: 'dist-chandigarh',
    name: 'Mohali / SAS Nagar',
    bbox: '30.66,76.68,30.74,76.75'
  }
];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
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
  for (const ep of ENDPOINTS) {
    try {
      console.log(`  Trying endpoint: ${ep}...`);
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
  console.log(`\n📡 Ingesting ${city.name} roads...`);
  const query = `[out:json][timeout:35][bbox:${city.bbox}];
(
  way["highway"="trunk"];
  way["highway"="primary"];
  way["highway"="secondary"];
  way["highway"="tertiary"];
  way["highway"="trunk_link"];
  way["highway"="primary_link"];
  way["highway"="secondary_link"];
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

  console.log(`  Parsed ${nodeMap.size} nodes and ${ways.length} ways for ${city.name}`);
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
      if (roadClass === 'trunk') name = `${city.name} GT / Express Highway Corridor`;
      else if (roadClass === 'primary') name = `${city.name} Major Arterial Road`;
      else if (roadClass === 'secondary') name = `${city.name} Sector Arterial Road`;
      else name = `${city.name} Urban Corridor`;
    }

    const lengthM = Math.round(polylineLength(coords));
    if (lengthM < 30) continue;

    const osmWayId = `osm-${city.cityTag}-${way.id}`;
    try {
      await prisma.roadSegment.upsert({
        where: { osmWayId },
        update: {
          name,
          roadClass,
          coordinates: JSON.stringify(coords),
          lengthM,
          cityTag: city.cityTag,
          districtId: city.districtId
        },
        create: {
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

  console.log(`  ✅ Successfully saved ${inserted} segments for ${city.name}`);
  return inserted;
}

async function main() {
  for (const city of CITIES) {
    await ingestCity(city);
    await sleep(2000);
  }

  const byCity = await prisma.roadSegment.groupBy({
    by: ['cityTag'],
    _count: { id: true }
  });
  console.log('\n📊 Final Updated Segment Breakdown across Punjab:');
  console.table(byCity.map(r => ({ cityTag: r.cityTag, totalSegments: r._count.id })));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
