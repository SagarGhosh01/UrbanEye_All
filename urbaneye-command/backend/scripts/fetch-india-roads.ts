import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CITY_CONFIGS = [
  { cityTag: 'delhi', bbox: '28.40,76.80,28.90,77.40', districtId: 'dist-new-delhi' },
  { cityTag: 'hyderabad', bbox: '17.20,78.20,17.60,78.70', districtId: 'dist-hyderabad' },
  { cityTag: 'chennai', bbox: '12.80,80.10,13.30,80.40', districtId: 'dist-chennai' },
  { cityTag: 'kolkata', bbox: '22.40,88.20,22.80,88.50', districtId: 'dist-kolkata' },
  { cityTag: 'pune', bbox: '18.40,73.70,18.70,74.00', districtId: 'dist-pune' },
  { cityTag: 'ahmedabad', bbox: '22.90,72.40,23.20,72.70', districtId: 'dist-ahmedabad' },
  { cityTag: 'jaipur', bbox: '26.70,75.60,27.10,76.00', districtId: 'dist-jaipur' },
  { cityTag: 'lucknow', bbox: '26.70,80.80,27.00,81.10', districtId: 'dist-lucknow' },
  { cityTag: 'chandigarh', bbox: '30.60,76.60,30.80,76.90', districtId: 'dist-chandigarh' },
  { cityTag: 'amritsar', bbox: '31.50,74.70,31.70,75.00', districtId: 'dist-amritsar' },
  { cityTag: 'bangalore', bbox: '12.85,77.45,13.10,77.78', districtId: 'dist-blr-urban' },
  { cityTag: 'mumbai', bbox: '18.90,72.75,19.30,73.00', districtId: 'dist-mumbai-suburban' },
  { cityTag: 'kapurthala', bbox: '31.10,75.20,31.60,76.00', districtId: 'dist-kapurthala' },
  { cityTag: 'jalandhar', bbox: '31.20,75.40,31.50,75.80', districtId: 'dist-jalandhar' },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function buildOverpassQuery(bbox: string): string {
  return `
[out:json][timeout:180][bbox:${bbox}];
(
  way["highway"="primary"];
  way["highway"="secondary"];
  way["highway"="trunk"];
  way["highway"="tertiary"];
  way["highway"="trunk_link"];
  way["highway"="primary_link"];
);
out body;
>;
out skel qt;
`;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return total;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processCity(config: { cityTag: string, bbox: string, districtId?: string }) {
  console.log(`\n================================================`);
  console.log(`🌆 Processing ${config.cityTag.toUpperCase()}`);
  console.log(`Bounding box: ${config.bbox}`);

  const query = buildOverpassQuery(config.bbox);

  let response: Response | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Trying endpoint: ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SRIMS/1.0 (srims-command-center@srims.org)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) {
        response = res;
        break;
      }
      console.warn(`  Endpoint ${endpoint} returned ${res.status}: ${res.statusText}`);
    } catch (err: any) {
      console.warn(`  Endpoint ${endpoint} error: ${err.message}`);
    }
  }

  if (!response) {
    console.error(`Failed to fetch data for ${config.cityTag}`);
    return;
  }

  const data = await response.json() as { elements: OverpassElement[] };
  console.log(`✅ Received ${data.elements.length} OSM elements`);

  const nodeMap = new Map<number, [number, number]>();
  const ways: OverpassElement[] = [];

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lat, el.lon]);
    } else if (el.type === 'way') {
      ways.push(el);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let totalLengthKm = 0;

  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 2) {
      skipped++;
      continue;
    }

    const coords: [number, number][] = [];
    for (const nodeId of way.nodes) {
      const coord = nodeMap.get(nodeId);
      if (coord) coords.push(coord);
    }

    if (coords.length < 2) {
      skipped++;
      continue;
    }

    const roadClass = way.tags?.highway || 'unclassified';
    const name = way.tags?.name || way.tags?.ref || null;
    const lengthM = polylineLength(coords);
    totalLengthKm += lengthM / 1000;

    const osmWayId = String(way.id);

    try {
      const existing = await prisma.roadSegment.findUnique({ where: { osmWayId } });
      if (existing) {
        await prisma.roadSegment.update({
          where: { osmWayId },
          data: {
            name,
            roadClass,
            coordinates: JSON.stringify(coords),
            lengthM,
            cityTag: config.cityTag,
            districtId: config.districtId,
          },
        });
        updated++;
      } else {
        await prisma.roadSegment.create({
          data: {
            osmWayId,
            name,
            roadClass,
            coordinates: JSON.stringify(coords),
            lengthM,
            cityTag: config.cityTag,
            districtId: config.districtId,
          },
        });
        inserted++;
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        updated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`📊 Summary for ${config.cityTag}:`);
  console.log(`  Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`  Coverage: ${totalLengthKm.toFixed(1)} km`);
}

async function main() {
  const args = process.argv.slice(2);
  let targetCity = '';
  const cityArg = args.find(a => a.startsWith('--city='));
  if (cityArg) {
    targetCity = cityArg.split('=')[1];
  }

  const citiesToProcess = targetCity 
    ? CITY_CONFIGS.filter(c => c.cityTag === targetCity)
    : CITY_CONFIGS;

  if (citiesToProcess.length === 0) {
    console.error(`City ${targetCity} not found in configurations.`);
    process.exit(1);
  }

  for (let i = 0; i < citiesToProcess.length; i++) {
    await processCity(citiesToProcess[i]);
    if (i < citiesToProcess.length - 1) {
      console.log('Sleeping for 3 seconds before next request...');
      await sleep(3000);
    }
  }

  console.log('\n✅ All cities processed successfully.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
