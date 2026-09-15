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

  await prisma.user.create({
    data: {
      id: 'usr-mumbai-1',
      email: 'head.mumbai@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Devendra Sawant (Mumbai Municipal Commissioner)',
      role: 'DISTRICT_HEAD',
      stateId: mh.id,
      districtId: mumbaiSuburban.id,
    },
  });

  // 4. Create Paired Bus Sessions across Districts
  const sessionBlr = await prisma.busDeviceSession.create({
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

  const sessionMum = await prisma.busDeviceSession.create({
    data: {
      pin: '984211',
      status: 'PAIRED',
      busLabel: 'BEST Bus Fleet #A-115',
      routeTag: 'Western Express Highway Expressway',
      districtId: mumbaiSuburban.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      pairedAt: new Date(),
    },
  });

  const sessionJal = await prisma.busDeviceSession.create({
    data: {
      pin: '984212',
      status: 'PAIRED',
      busLabel: 'Punbus Fleet #Jalandhar-Express',
      routeTag: 'Jalandhar GT Road Bypass',
      districtId: jalandhar.id,
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

  // 6. Seed Mumbai Road Network Segments
  const MUMBAI_ROAD_SEGMENTS = [
    {
      osmWayId: 'mum-way-weh',
      name: 'Western Express Highway Expressway Corridor',
      roadClass: 'trunk',
      cityTag: 'mumbai',
      districtId: mumbaiSuburban.id,
      coordinates: JSON.stringify([
        [19.0400, 72.8450],
        [19.0760, 72.8550],
        [19.1150, 72.8620],
        [19.1550, 72.8680],
      ]),
      lengthM: 14200,
    },
    {
      osmWayId: 'mum-way-sealink',
      name: 'Bandra-Worli Sea Link Expressway',
      roadClass: 'trunk',
      cityTag: 'mumbai',
      districtId: mumbaiSuburban.id,
      coordinates: JSON.stringify([
        [19.0150, 72.8160],
        [19.0330, 72.8170],
        [19.0500, 72.8220],
      ]),
      lengthM: 5600,
    },
    {
      osmWayId: 'mum-way-marinedrive',
      name: 'Marine Drive Netaji Subhash Chandra Bose Road',
      roadClass: 'primary',
      cityTag: 'mumbai',
      districtId: mumbaiSuburban.id,
      coordinates: JSON.stringify([
        [18.9260, 72.8220],
        [18.9438, 72.8232],
        [18.9550, 72.8190],
      ]),
      lengthM: 3600,
    },
    {
      osmWayId: 'mum-way-eeh',
      name: 'Eastern Express Highway Corridor',
      roadClass: 'trunk',
      cityTag: 'mumbai',
      districtId: mumbaiSuburban.id,
      coordinates: JSON.stringify([
        [19.0300, 72.8800],
        [19.0650, 72.8900],
        [19.1000, 72.9200],
      ]),
      lengthM: 9800,
    },
  ];

  // 7. Seed Kapurthala & Jalandhar Road Network Segments
  const PUNJAB_ROAD_SEGMENTS = [
    {
      osmWayId: 'kap-way-nh44',
      name: 'NH-44 Kapurthala Highway Expressway Corridor',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.2200, 75.6800],
        [31.2536, 75.7037],
        [31.2800, 75.7200],
      ]),
      lengthM: 7800,
    },
    {
      osmWayId: 'jal-way-gtroad-bypass',
      name: 'Jalandhar GT Road Expressway Bypass',
      roadClass: 'trunk',
      cityTag: 'jalandhar',
      districtId: jalandhar.id,
      coordinates: JSON.stringify([
        [31.3000, 75.5500],
        [31.3260, 75.5762],
        [31.3500, 75.6000],
      ]),
      lengthM: 8400,
    },
    {
      osmWayId: 'jal-way-modeltown',
      name: 'Model Town Main Commercial Corridor',
      roadClass: 'primary',
      cityTag: 'jalandhar',
      districtId: jalandhar.id,
      coordinates: JSON.stringify([
        [31.3150, 75.5780],
        [31.3210, 75.5810],
        [31.3280, 75.5850],
      ]),
      lengthM: 2200,
    },
  ];

  const ALL_DEMO_SEGMENTS = [
    ...BANGALORE_ROAD_SEGMENTS,
    ...MUMBAI_ROAD_SEGMENTS,
    ...PUNJAB_ROAD_SEGMENTS,
  ];

  for (const seg of ALL_DEMO_SEGMENTS) {
    await prisma.roadSegment.create({ data: seg });
  }

  // Seed Defect & Vehicle Density Hotspots across all Districts
  const SEEDED_EVENTS = [
    // Bangalore
    {
      id: 'evt-blr-pothole-silkboard',
      deviceSessionId: sessionBlr.id,
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
      deviceSessionId: sessionBlr.id,
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
      deviceSessionId: sessionBlr.id,
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

    // Kapurthala
    {
      id: 'evt-kap-pothole-nh44',
      deviceSessionId: sessionJal.id,
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

    // Jalandhar
    {
      id: 'evt-jal-crack-gtroad',
      deviceSessionId: sessionJal.id,
      busLabel: 'Punbus Fleet #Jalandhar-Express',
      type: 'ROAD_CRACK',
      severity: 'HIGH',
      latitude: 31.3260,
      longitude: 75.5762,
      confidence: 0.89,
      status: 'NEW',
      districtId: jalandhar.id,
      estimatedRepairCost: 22000,
    },

    // Mumbai
    {
      id: 'evt-mum-pothole-weh',
      deviceSessionId: sessionMum.id,
      busLabel: 'BEST Bus Fleet #A-115',
      type: 'POTHOLE',
      severity: 'CRITICAL',
      latitude: 19.0760,
      longitude: 72.8777,
      confidence: 0.96,
      status: 'NEW',
      districtId: mumbaiSuburban.id,
      estimatedRepairCost: 48000,
    },
    {
      id: 'evt-mum-damage-sealink',
      deviceSessionId: sessionMum.id,
      busLabel: 'BEST Bus Fleet #C-42',
      type: 'SURFACE_DAMAGE',
      severity: 'HIGH',
      latitude: 19.0330,
      longitude: 72.8170,
      confidence: 0.91,
      status: 'ASSIGNED_FOR_REPAIR',
      districtId: mumbaiSuburban.id,
      estimatedRepairCost: 38000,
    },
  ];

  for (const ev of SEEDED_EVENTS) {
    await prisma.roadEvent.create({ data: ev });
  }

  console.log('✅ SQLite Database dev.db successfully initialized with clean user accounts, Bangalore/Mumbai/Punjab road network segments, and spatial defect hotspots!');
  console.log('★ Demo District Head Accounts:');
  console.log('   - Bangalore: head.bengaluru@urbaneye.gov.in / UrbanEye@2026');
  console.log('   - Mumbai: head.mumbai@urbaneye.gov.in / UrbanEye@2026');
  console.log('   - Kapurthala: head.kapurthala@urbaneye.gov.in / UrbanEye@2026');
  console.log('   - Jalandhar: head.jalandhar@urbaneye.gov.in / UrbanEye@2026');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

