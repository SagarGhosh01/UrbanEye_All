#!/usr/bin/env tsx
/**
 * Road Network Ingestion Script — Bangalore
 * ===========================================
 * Fetches real road geometry from the OpenStreetMap Overpass API for Bangalore,
 * filtered to primary/secondary/trunk/tertiary roads, and stores each road
 * segment in the RoadSegment Prisma table.
 *
 * Usage:
 *   npx tsx scripts/fetch-road-network.ts
 *
 * This only needs to run ONCE per city. Data is stored permanently in SQLite.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bangalore bounding box (South, West, North, East)
const BANGALORE_BBOX = '12.85,77.45,13.10,77.78';
const CITY_TAG = 'bangalore';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Key corridors to verify after ingestion
const KEY_CORRIDORS = [
  { name: 'Silk Board Junction', lat: 12.9177, lon: 77.6238 },
  { name: 'Outer Ring Road (Marathahalli)', lat: 12.9563, lon: 77.7008 },
  { name: 'KR Puram', lat: 12.9988, lon: 77.6960 },
  { name: 'Hebbal Flyover', lat: 13.0358, lon: 77.5970 },
  { name: 'MG Road', lat: 12.9756, lon: 77.6068 },
  { name: 'Old Airport Road', lat: 12.9610, lon: 77.6470 },
  { name: 'Brigade Road', lat: 12.9716, lon: 77.6070 },
];

/**
 * Build Overpass QL query for Bangalore road network
 */
function buildOverpassQuery(): string {
  return `
[out:json][timeout:180][bbox:${BANGALORE_BBOX}];
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

/**
 * Compute distance between two lat/lng points in meters (Haversine)
 */
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

/**
 * Compute total polyline length in meters
 */
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

async function main() {
  console.log('🗺️  SRIMS Road Network Ingestion — Bangalore');
  console.log('================================================');
  console.log(`Bounding box: ${BANGALORE_BBOX}`);
  console.log(`Road types: primary, secondary, trunk, tertiary + link roads`);
  console.log('');

  // Step 1: Query Overpass API
  console.log('📡 Querying Overpass API (this may take 30-60 seconds)...');
  const query = buildOverpassQuery();

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
    throw new Error('All Overpass API endpoints failed');
  }

  const data = await response.json() as { elements: OverpassElement[] };
  console.log(`✅ Received ${data.elements.length} OSM elements`);

  // Step 2: Build node lookup map
  const nodeMap = new Map<number, [number, number]>();
  const ways: OverpassElement[] = [];

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lat, el.lon]);
    } else if (el.type === 'way') {
      ways.push(el);
    }
  }

  console.log(`📊 Parsed ${nodeMap.size} nodes and ${ways.length} ways`);

  // Step 3: Upsert road segments
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let totalLengthKm = 0;
  let totalPoints = 0;

  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 2) {
      skipped++;
      continue;
    }

    // Resolve node IDs to coordinates
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
    totalPoints += coords.length;

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
            cityTag: CITY_TAG,
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
            cityTag: CITY_TAG,
          },
        });
        inserted++;
      }
    } catch (err: any) {
      // Handle race condition on unique constraint
      if (err.code === 'P2002') {
        updated++;
      } else {
        console.error(`  ⚠️ Failed to upsert way ${way.id}: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📈 Ingestion Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`  New segments inserted:  ${inserted}`);
  console.log(`  Existing updated:       ${updated}`);
  console.log(`  Skipped (malformed):    ${skipped}`);
  console.log(`  Total road coverage:    ${totalLengthKm.toFixed(1)} km`);
  console.log(`  Total coordinate points: ${totalPoints}`);

  // Step 4: Verify key corridors
  console.log('');
  console.log('🔍 Verifying Key Bangalore Corridors...');
  const allSegments = await prisma.roadSegment.findMany({ where: { cityTag: CITY_TAG } });

  for (const corridor of KEY_CORRIDORS) {
    let nearestDist = Infinity;
    let nearestName = '';
    for (const seg of allSegments) {
      const coords: [number, number][] = JSON.parse(seg.coordinates);
      for (const [lat, lon] of coords) {
        const dist = haversineDistance(corridor.lat, corridor.lon, lat, lon);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestName = seg.name || `way:${seg.osmWayId}`;
        }
      }
    }
    const status = nearestDist < 500 ? '✅' : nearestDist < 1500 ? '⚠️' : '❌';
    console.log(`  ${status} ${corridor.name}: nearest segment "${nearestName}" at ${Math.round(nearestDist)}m`);
  }

  const totalStored = await prisma.roadSegment.count({ where: { cityTag: CITY_TAG } });
  console.log('');
  console.log(`✅ Total ${totalStored} road segments stored for ${CITY_TAG}`);
  console.log('Done!');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
