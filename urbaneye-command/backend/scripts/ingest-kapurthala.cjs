const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Kapurthala district geographic bounding box
// Covers Kapurthala city, Phagwara, Sultanpur Lodhi, Bholath, Subhanpur, Dhilwan, Nadala
const BBOX = '31.10,75.15,31.62,75.95';
const CITY_TAG = 'kapurthala';
const DISTRICT_ID = 'dist-kapurthala';

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

async function fetchKapurthalaRoads() {
  console.log(`📡 Fetching complete road network for Kapurthala District (BBOX: ${BBOX})...`);

  const query = `[out:json][timeout:90][bbox:${BBOX}];
(
  way["highway"="trunk"];
  way["highway"="primary"];
  way["highway"="secondary"];
  way["highway"="tertiary"];
  way["highway"="trunk_link"];
  way["highway"="primary_link"];
  way["highway"="secondary_link"];
  way["highway"="residential"]["name"];
  way["highway"="unclassified"]["name"];
);
out body;
>;
out skel qt;
`;

  let response = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Querying ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'UrbanEye/1.0',
          'Accept': 'application/json'
        },
        body: `data=${encodeURIComponent(query)}`
      });
      if (res.ok) {
        response = res;
        break;
      }
      console.warn(`  Endpoint ${endpoint} returned status ${res.status}`);
    } catch (err) {
      console.warn(`  Endpoint ${endpoint} error: ${err.message}`);
    }
  }

  if (!response) {
    throw new Error('Could not query Overpass API endpoints');
  }

  const data = await response.json();
  console.log(`✅ Received ${data.elements.length} OSM elements from Overpass`);

  const nodeMap = new Map();
  const ways = [];

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lat, el.lon]);
    } else if (el.type === 'way') {
      ways.push(el);
    }
  }

  console.log(`Parsed ${nodeMap.size} nodes and ${ways.length} road ways across Kapurthala`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 2) {
      skipped++;
      continue;
    }

    const coords = [];
    for (const nid of way.nodes) {
      const c = nodeMap.get(nid);
      if (c) coords.push(c);
    }

    if (coords.length < 2) {
      skipped++;
      continue;
    }

    let roadClass = way.tags?.highway || 'secondary';
    if (roadClass.endsWith('_link')) {
      roadClass = roadClass.replace('_link', '');
    }
    if (roadClass === 'residential' || roadClass === 'unclassified') {
      roadClass = 'tertiary';
    }

    let name = way.tags?.name || way.tags?.['name:en'] || way.tags?.ref || null;
    if (!name) {
      if (roadClass === 'trunk') name = 'Kapurthala–GT Road Expressway Corridor';
      else if (roadClass === 'primary') name = 'Kapurthala District State Highway';
      else if (roadClass === 'secondary') name = 'Kapurthala Regional Arterial Road';
      else name = 'Kapurthala Connecting Road';
    }

    const lengthM = Math.round(polylineLength(coords));
    if (lengthM < 40) {
      skipped++;
      continue;
    }

    const osmWayId = `osm-kap-${way.id}`;

    try {
      await prisma.roadSegment.upsert({
        where: { osmWayId },
        update: {
          name,
          roadClass,
          coordinates: JSON.stringify(coords),
          lengthM,
          cityTag: CITY_TAG,
          districtId: DISTRICT_ID
        },
        create: {
          osmWayId,
          name,
          roadClass,
          coordinates: JSON.stringify(coords),
          lengthM,
          cityTag: CITY_TAG,
          districtId: DISTRICT_ID
        }
      });
      inserted++;
    } catch (err) {
      skipped++;
    }
  }

  console.log(`🎉 Ingestion finished! Inserted/updated: ${inserted} Kapurthala road segments. Skipped: ${skipped}`);
  const total = await prisma.roadSegment.count({ where: { cityTag: CITY_TAG } });
  console.log(`📊 Total Kapurthala segments in database: ${total}`);

  await prisma.$disconnect();
}

fetchKapurthalaRoads().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
