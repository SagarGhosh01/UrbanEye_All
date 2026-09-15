const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PUNJAB_CITIES = [
  {
    cityTag: 'jalandhar',
    districtId: 'dist-jalandhar',
    name: 'Jalandhar',
    bbox: '31.24,75.50,31.40,75.68'
  },
  {
    cityTag: 'ludhiana',
    districtId: 'dist-ludhiana',
    name: 'Ludhiana',
    bbox: '30.82,75.76,30.96,75.92'
  },
  {
    cityTag: 'amritsar',
    districtId: 'dist-amritsar',
    name: 'Amritsar',
    bbox: '31.58,74.82,31.70,74.95'
  },
  {
    cityTag: 'patiala',
    districtId: null,
    name: 'Patiala',
    bbox: '30.29,76.35,30.38,76.45'
  },
  {
    cityTag: 'bathinda',
    districtId: null,
    name: 'Bathinda',
    bbox: '30.18,74.92,30.25,75.01'
  },
  {
    cityTag: 'mohali',
    districtId: 'dist-chandigarh',
    name: 'Mohali / SAS Nagar',
    bbox: '30.66,76.68,30.74,76.75'
  }
];

const OVERPASS_ENDPOINT = 'https://lz4.overpass-api.de/api/interpreter';

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

async function ingestCity(city) {
  console.log(`\n📡 Fetching roads for ${city.name} (BBOX: ${city.bbox})...`);
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

  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UrbanEye/1.0',
        'Accept': 'application/json'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!res.ok) {
      console.error(`  ❌ HTTP error: ${res.status}`);
      return 0;
    }

    const data = await res.json();
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
        // ignore individual errors
      }
    }

    console.log(`  ✅ Successfully saved ${inserted} segments for ${city.name}`);
    return inserted;
  } catch (err) {
    console.error(`  ❌ Error processing ${city.name}:`, err.message);
    return 0;
  }
}

async function main() {
  console.log('🚀 Starting Fast Comprehensive Ingestion for All Major Punjab Cities...');
  let grandTotal = 0;
  for (const city of PUNJAB_CITIES) {
    const count = await ingestCity(city);
    grandTotal += count;
    console.log(`  Cooling down 2s...`);
    await sleep(2000);
  }

  console.log(`\n🎉 INGESTION COMPLETE!`);
  console.log(`Total new segments inserted across Punjab: ${grandTotal}`);

  const byCity = await prisma.roadSegment.groupBy({
    by: ['cityTag'],
    _count: { id: true }
  });
  console.log('\n📊 Updated Database Segment Breakdown across all Cities:');
  console.table(byCity.map(r => ({ cityTag: r.cityTag, totalSegments: r._count.id })));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error during ingestion:', err);
  await prisma.$disconnect();
  process.exit(1);
});
