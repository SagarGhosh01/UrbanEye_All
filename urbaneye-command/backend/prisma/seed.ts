import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with comprehensive administrative hierarchy, road defects, incidents, safety risk zones, and predictive hotspots...');

  // Clean existing data for initial fresh seed
  await prisma.urbanRecommendation.deleteMany();
  await prisma.predictiveHotspot.deleteMany();
  await prisma.safetyRiskZone.deleteMany();
  await prisma.vehicleTrack.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.roadEvent.deleteMany();
  await prisma.roadSegment.deleteMany();
  await prisma.busDeviceSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.district.deleteMany();
  await prisma.state.deleteMany();

  // 1. Create States
  const mh = await prisma.state.create({
    data: {
      id: 'state-maharashtra',
      code: 'MH',
      name: 'Maharashtra',
      centerLat: 19.7515,
      centerLon: 75.7139,
    },
  });

  const ka = await prisma.state.create({
    data: {
      id: 'state-karnataka',
      code: 'KA',
      name: 'Karnataka',
      centerLat: 15.3173,
      centerLon: 75.7139,
    },
  });

  const dl = await prisma.state.create({
    data: {
      id: 'state-delhi',
      code: 'DL',
      name: 'Delhi NCT',
      centerLat: 28.7041,
      centerLon: 77.1025,
    },
  });

  const pb = await prisma.state.create({
    data: {
      id: 'state-punjab',
      code: 'PB',
      name: 'Punjab',
      centerLat: 31.1471,
      centerLon: 75.3412,
    },
  });

  // 2. Create Districts
  const kapurthala = await prisma.district.create({
    data: {
      id: 'dist-kapurthala',
      code: 'KAPURTHALA',
      name: 'Kapurthala',
      stateId: pb.id,
      centerLat: 31.2536,
      centerLon: 75.7037, // NH-44 Corridor
      minLat: 31.10,
      maxLat: 31.60,
      minLon: 75.20,
      maxLon: 76.00,
    },
  });

  const jalandhar = await prisma.district.create({
    data: {
      id: 'dist-jalandhar',
      code: 'JALANDHAR',
      name: 'Jalandhar',
      stateId: pb.id,
      centerLat: 31.3260,
      centerLon: 75.5762,
      minLat: 31.00,
      maxLat: 31.60,
      minLon: 75.30,
      maxLon: 75.90,
    },
  });

  const ludhiana = await prisma.district.create({
    data: {
      id: 'dist-ludhiana',
      code: 'LUDHIANA',
      name: 'Ludhiana',
      stateId: pb.id,
      centerLat: 30.9010,
      centerLon: 75.8573,
      minLat: 30.70,
      maxLat: 31.10,
      minLon: 75.60,
      maxLon: 76.20,
    },
  });

  const mumbaiSuburban = await prisma.district.create({
    data: {
      id: 'dist-mumbai-suburban',
      code: 'MUM_SUB',
      name: 'Mumbai Suburban',
      stateId: mh.id,
      centerLat: 19.0760,
      centerLon: 72.8777,
      minLat: 18.90,
      maxLat: 19.27,
      minLon: 72.77,
      maxLon: 72.98,
    },
  });

  const blrUrban = await prisma.district.create({
    data: {
      id: 'dist-bengaluru-urban',
      code: 'BLR_URB',
      name: 'Bengaluru Urban',
      stateId: ka.id,
      centerLat: 12.9716,
      centerLon: 77.5946,
      minLat: 12.80,
      maxLat: 13.15,
      minLon: 77.45,
      maxLon: 77.75,
    },
  });

  // Default password for all seeded accounts
  const defaultPassword = 'UrbanEye@2026';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // 3. Create Hierarchical Accounts
  const admin = await prisma.user.create({
    data: {
      id: 'usr-admin-national',
      email: 'admin@urbaneye.gov.in',
      passwordHash,
      name: 'Shri Rajesh Verma (MoRTH Director)',
      role: 'NATIONAL_ADMIN',
    },
  });

  const statePb = await prisma.user.create({
    data: {
      id: 'usr-admin-pb',
      email: 'admin.pb@urbaneye.gov.in',
      passwordHash,
      name: 'S. Harpreet Singh (Punjab PWD Chief Engineer)',
      role: 'STATE_ADMIN',
      stateId: pb.id,
    },
  });

  const headKapurthala = await prisma.user.create({
    data: {
      id: 'usr-kapurthala-1',
      email: 'head.kapurthala@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Gurpreet Singh (Kapurthala Road Commissioner)',
      role: 'DISTRICT_HEAD',
      stateId: pb.id,
      districtId: kapurthala.id,
    },
  });

  await prisma.user.create({
    data: {
      id: 'usr-jalandhar-1',
      email: 'head.jalandhar@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Manjit Kaur (Jalandhar Infrastructure Head)',
      role: 'DISTRICT_HEAD',
      stateId: pb.id,
      districtId: jalandhar.id,
    },
  });

  await prisma.user.create({
    data: {
      id: 'usr-bengaluru-1',
      email: 'head.bengaluru@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Anand Rao (Bengaluru Transport Commissioner)',
      role: 'DISTRICT_HEAD',
      stateId: ka.id,
      districtId: blrUrban.id,
    },
  });

  // 4. Create Paired Bus Session
  const session = await prisma.busDeviceSession.create({
    data: {
      pin: '984210',
      status: 'PAIRED',
      busLabel: 'BMTC Bus Fleet #500-D',
      routeTag: 'Route 500-D — Outer Ring Road Corridor',
      districtId: blrUrban.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      pairedAt: new Date(),
    },
  });

  // 5. Seed Bangalore Road Network Segments (for Vector Polyline Congestion Heatmap)
  const BANGALORE_ROAD_SEGMENTS = [
    {
      osmWayId: 'blr-way-orr-silkboard',
      name: 'Outer Ring Road (Silk Board Junction to HSR Layout)',
      roadClass: 'trunk',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9172, 77.6228],
        [12.9195, 77.6350],
        [12.9230, 77.6440],
        [12.9270, 77.6550],
      ]),
      lengthM: 3800,
    },
    {
      osmWayId: 'blr-way-orr-bellandur-marathahalli',
      name: 'Outer Ring Road (Bellandur to Marathahalli)',
      roadClass: 'trunk',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9270, 77.6780],
        [12.9370, 77.6900],
        [12.9480, 77.6950],
        [12.9562, 77.6980],
      ]),
      lengthM: 4200,
    },
    {
      osmWayId: 'blr-way-indiranagar-100ft',
      name: 'Indiranagar 100ft Road (CMH Road to Old Airport Road)',
      roadClass: 'primary',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9784, 77.6408],
        [12.9710, 77.6405],
        [12.9620, 77.6401],
      ]),
      lengthM: 2100,
    },
    {
      osmWayId: 'blr-way-ecity-flyover',
      name: 'Electronic City Hosur Road Elevated Expressway',
      roadClass: 'trunk',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.8452, 77.6602],
        [12.8650, 77.6520],
        [12.8850, 77.6410],
        [12.9100, 77.6300],
      ]),
      lengthM: 8500,
    },
    {
      osmWayId: 'blr-way-hebbal-flyover',
      name: 'Hebbal Flyover (Airport Express Expressway NH-44)',
      roadClass: 'trunk',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [13.0358, 77.5970],
        [13.0480, 77.5950],
        [13.0620, 77.5920],
      ]),
      lengthM: 3200,
    },
    {
      osmWayId: 'blr-way-mg-road',
      name: 'MG Road & Trinity Circle Corridor',
      roadClass: 'primary',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9750, 77.6070],
        [12.9740, 77.6180],
        [12.9730, 77.6250],
      ]),
      lengthM: 2000,
    },
    {
      osmWayId: 'blr-way-kr-puram-bridge',
      name: 'KR Puram Hanging Bridge & Tin Factory Junction',
      roadClass: 'trunk',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9960, 77.6750],
        [12.9985, 77.6840],
        [13.0010, 77.6940],
      ]),
      lengthM: 2400,
    },
    {
      osmWayId: 'blr-way-old-airport-road',
      name: 'Old Airport Road Corridor',
      roadClass: 'primary',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9610, 77.6470],
        [12.9605, 77.6600],
        [12.9600, 77.6700],
      ]),
      lengthM: 2600,
    },
    {
      osmWayId: 'blr-way-brigade-road',
      name: 'Brigade Road Corridor',
      roadClass: 'secondary',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9716, 77.6070],
        [12.9680, 77.6073],
        [12.9650, 77.6075],
      ]),
      lengthM: 800,
    },
    {
      osmWayId: 'blr-way-koramangala-80ft',
      name: 'Koramangala 80ft Road Corridor',
      roadClass: 'secondary',
      cityTag: 'bangalore',
      districtId: blrUrban.id,
      coordinates: JSON.stringify([
        [12.9350, 77.6180],
        [12.9350, 77.6280],
        [12.9350, 77.6350],
      ]),
      lengthM: 1900,
    },
  ];

  for (const seg of BANGALORE_ROAD_SEGMENTS) {
    await prisma.roadSegment.create({ data: seg });
  }

  // 6. Seed Bangalore & Kapurthala Road Defects (Spatial Density Heatmap)
  const SEEDED_EVENTS = [
    {
      id: 'evt-blr-pothole-silkboard',
      deviceSessionId: session.id,
      busLabel: 'BMTC Bus Fleet #500-D',
      type: 'POTHOLE',
      severity: 'CRITICAL',
      latitude: 12.9180,
      longitude: 77.6260,
      confidence: 0.94,
      status: 'NEW',
      districtId: blrUrban.id,
      estimatedRepairCost: 45000,
    },
    {
      id: 'evt-blr-crack-marathahalli',
      deviceSessionId: session.id,
      busLabel: 'BMTC Bus Fleet #500-D',
      type: 'ALLIGATOR_CRACK',
      severity: 'HIGH',
      latitude: 12.9550,
      longitude: 77.6960,
      confidence: 0.88,
      status: 'NEW',
      districtId: blrUrban.id,
      estimatedRepairCost: 28000,
    },
    {
      id: 'evt-blr-pothole-indiranagar',
      deviceSessionId: session.id,
      busLabel: 'BMTC Bus Fleet #335-E',
      type: 'POTHOLE',
      severity: 'MEDIUM',
      latitude: 12.9770,
      longitude: 77.6406,
      confidence: 0.91,
      status: 'ASSIGNED_FOR_REPAIR',
      districtId: blrUrban.id,
      estimatedRepairCost: 15000,
    },
    {
      id: 'evt-blr-damage-krpuram',
      deviceSessionId: session.id,
      busLabel: 'BMTC Bus Fleet #500-D',
      type: 'SURFACE_DAMAGE',
      severity: 'CRITICAL',
      latitude: 12.9970,
      longitude: 77.6780,
      confidence: 0.96,
      status: 'NEW',
      districtId: blrUrban.id,
      estimatedRepairCost: 65000,
    },
    {
      id: 'evt-blr-pothole-hebbal',
      deviceSessionId: session.id,
      busLabel: 'BMTC Bus Fleet #KIAS-9',
      type: 'POTHOLE',
      severity: 'HIGH',
      latitude: 13.0370,
      longitude: 77.5960,
      confidence: 0.92,
      status: 'NEW',
      districtId: blrUrban.id,
      estimatedRepairCost: 32000,
    },
    {
      id: 'evt-kap-pothole-nh44',
      deviceSessionId: session.id,
      busLabel: 'Punjab Bus Fleet #24',
      type: 'POTHOLE',
      severity: 'CRITICAL',
      latitude: 31.2536,
      longitude: 75.7037,
      confidence: 0.95,
      status: 'NEW',
      districtId: kapurthala.id,
      estimatedRepairCost: 35000,
    },
  ];

  for (const ev of SEEDED_EVENTS) {
    await prisma.roadEvent.create({ data: ev });
  }

  console.log('✅ SQLite Database dev.db successfully initialized with clean user accounts, Bangalore road network segments, and spatial defect hotspots!');
  console.log('★ Demo District Head Accounts:');
  console.log('   - Bangalore: head.bengaluru@urbaneye.gov.in / UrbanEye@2026');
  console.log('   - Kapurthala: head.kapurthala@urbaneye.gov.in / UrbanEye@2026');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

