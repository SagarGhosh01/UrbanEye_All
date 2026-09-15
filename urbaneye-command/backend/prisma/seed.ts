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

  const tg = await prisma.state.create({
    data: { id: 'state-telangana', code: 'TG', name: 'Telangana', centerLat: 17.1232, centerLon: 79.2088 },
  });
  const tn = await prisma.state.create({
    data: { id: 'state-tamil-nadu', code: 'TN', name: 'Tamil Nadu', centerLat: 11.1271, centerLon: 78.6569 },
  });
  const wb = await prisma.state.create({
    data: { id: 'state-west-bengal', code: 'WB', name: 'West Bengal', centerLat: 22.9868, centerLon: 87.8550 },
  });
  const rj = await prisma.state.create({
    data: { id: 'state-rajasthan', code: 'RJ', name: 'Rajasthan', centerLat: 27.0238, centerLon: 74.2179 },
  });
  const gj = await prisma.state.create({
    data: { id: 'state-gujarat', code: 'GJ', name: 'Gujarat', centerLat: 22.2587, centerLon: 71.1924 },
  });
  const up = await prisma.state.create({
    data: { id: 'state-uttar-pradesh', code: 'UP', name: 'Uttar Pradesh', centerLat: 26.8467, centerLon: 80.9462 },
  });
  const ch = await prisma.state.create({
    data: { id: 'state-chandigarh', code: 'CH', name: 'Chandigarh UT', centerLat: 30.7333, centerLon: 76.7794 },
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

  const newDelhi = await prisma.district.create({
    data: { id: 'dist-new-delhi', code: 'NEW_DELHI', name: 'New Delhi', stateId: dl.id, centerLat: 28.6139, centerLon: 77.2090 },
  });
  const hyderabad = await prisma.district.create({
    data: { id: 'dist-hyderabad', code: 'HYDERABAD', name: 'Hyderabad', stateId: tg.id, centerLat: 17.3850, centerLon: 78.4867 },
  });
  const chennai = await prisma.district.create({
    data: { id: 'dist-chennai', code: 'CHENNAI', name: 'Chennai', stateId: tn.id, centerLat: 13.0827, centerLon: 80.2707 },
  });
  const kolkata = await prisma.district.create({
    data: { id: 'dist-kolkata', code: 'KOLKATA', name: 'Kolkata', stateId: wb.id, centerLat: 22.5726, centerLon: 88.3639 },
  });
  const pune = await prisma.district.create({
    data: { id: 'dist-pune', code: 'PUNE', name: 'Pune', stateId: mh.id, centerLat: 18.5204, centerLon: 73.8567 },
  });
  const ahmedabad = await prisma.district.create({
    data: { id: 'dist-ahmedabad', code: 'AHMEDABAD', name: 'Ahmedabad', stateId: gj.id, centerLat: 23.0225, centerLon: 72.5714 },
  });
  const jaipur = await prisma.district.create({
    data: { id: 'dist-jaipur', code: 'JAIPUR', name: 'Jaipur', stateId: rj.id, centerLat: 26.9124, centerLon: 75.7873 },
  });
  const lucknow = await prisma.district.create({
    data: { id: 'dist-lucknow', code: 'LUCKNOW', name: 'Lucknow', stateId: up.id, centerLat: 26.8467, centerLon: 80.9462 },
  });
  const chandigarhDist = await prisma.district.create({
    data: { id: 'dist-chandigarh', code: 'CHANDIGARH', name: 'Chandigarh', stateId: ch.id, centerLat: 30.7333, centerLon: 76.7794 },
  });
  const amritsar = await prisma.district.create({
    data: { id: 'dist-amritsar', code: 'AMRITSAR', name: 'Amritsar', stateId: pb.id, centerLat: 31.6340, centerLon: 74.8723 },
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
        [19.0480, 72.8420],
        [19.0620, 72.8480],
        [19.0810, 72.8530],
        [19.1020, 72.8570],
        [19.1240, 72.8610],
        [19.1480, 72.8650],
        [19.1720, 72.8690],
        [19.2010, 72.8730],
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
        [19.0250, 72.8165],
        [19.0330, 72.8170],
        [19.0420, 72.8190],
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
        [18.9320, 72.8228],
        [18.9400, 72.8235],
        [18.9480, 72.8220],
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
        [19.0480, 72.8840],
        [19.0650, 72.8900],
        [19.0820, 72.9030],
        [19.1000, 72.9200],
      ]),
      lengthM: 9800,
    },
  ];

  // 7. Seed Kapurthala, Jalandhar & Phagwara District-Wide Road Network Segments
  const PUNJAB_ROAD_SEGMENTS = [
    {
      osmWayId: 'kap-way-nh44-south',
      name: 'NH-44 Phillaur to Phagwara GT Road Expressway Corridor',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.0200, 75.7900],
        [31.0800, 75.7850],
        [31.1400, 75.7800],
        [31.2180, 75.7720],
      ]),
      lengthM: 22000,
    },
    {
      osmWayId: 'kap-way-nh44-north',
      name: 'NH-44 Phagwara to Jalandhar GT Road Expressway Corridor',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.2180, 75.7720],
        [31.2460, 75.7260],
        [31.2780, 75.6780],
        [31.3260, 75.5760],
      ]),
      lengthM: 21000,
    },
    {
      osmWayId: 'kap-way-sh24-west',
      name: 'SH-24 Kapurthala City to Subhanpur Highway Corridor',
      roadClass: 'primary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3800, 75.3850],
        [31.3920, 75.4120],
        [31.4080, 75.4620],
      ]),
      lengthM: 9800,
    },
    {
      osmWayId: 'kap-way-sh24-east',
      name: 'SH-24 Subhanpur to Phagwara Main Highway Corridor',
      roadClass: 'primary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.4080, 75.4620],
        [31.3650, 75.5100],
        [31.3050, 75.5800],
        [31.2450, 75.6600],
        [31.2180, 75.7720],
      ]),
      lengthM: 32000,
    },
    {
      osmWayId: 'kap-way-sh14-nakodar',
      name: 'SH-14 Kapurthala to Nakodar Regional Highway Corridor',
      roadClass: 'primary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3750, 75.3800],
        [31.3100, 75.4150],
        [31.2300, 75.4450],
        [31.1300, 75.4800],
      ]),
      lengthM: 28500,
    },
    {
      osmWayId: 'kap-way-sh71-shahkot',
      name: 'SH-71 Jalandhar to Nakodar & Shahkot Corridor',
      roadClass: 'primary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3260, 75.5760],
        [31.2200, 75.5200],
        [31.1300, 75.4800],
        [31.0800, 75.3400],
      ]),
      lengthM: 34000,
    },
    {
      osmWayId: 'kap-way-sultanpur',
      name: 'Kapurthala to Sultanpur Lodhi & Goindwal Sahib Corridor',
      roadClass: 'primary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3780, 75.3720],
        [31.3200, 75.2900],
        [31.2150, 75.1950],
        [31.3100, 75.1500],
      ]),
      lengthM: 36000,
    },
    {
      osmWayId: 'kap-way-nh3-subhanpur',
      name: 'NH-3 Subhanpur to Kartarpur to Jalandhar GT Road',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.4080, 75.4620],
        [31.3850, 75.5000],
        [31.3500, 75.5400],
        [31.3260, 75.5760],
      ]),
      lengthM: 14200,
    },
    {
      osmWayId: 'kap-way-nh70-adampur',
      name: 'NH-70 Jalandhar to Adampur to Hoshiarpur Highway',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3260, 75.5760],
        [31.3800, 75.6500],
        [31.4300, 75.7200],
        [31.5200, 75.9000],
      ]),
      lengthM: 38000,
    },
    {
      osmWayId: 'kap-way-nh344a-banga',
      name: 'NH-344A Phagwara to Banga to Nawanshahr Expressway',
      roadClass: 'trunk',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.2180, 75.7720],
        [31.1800, 75.8800],
        [31.1900, 75.9900],
        [31.1200, 76.1200],
      ]),
      lengthM: 41000,
    },
    {
      osmWayId: 'kap-way-phagwara-hoshiarpur',
      name: 'Phagwara to Narur & Hoshiarpur District Corridor',
      roadClass: 'secondary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.2240, 75.7750],
        [31.2800, 75.8200],
        [31.3500, 75.8800],
        [31.4500, 75.9200],
      ]),
      lengthM: 31000,
    },
    {
      osmWayId: 'kap-way-nakodar-phagwara',
      name: 'Nakodar to Nurmahal to Phillaur & Phagwara Corridor',
      roadClass: 'secondary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.1300, 75.4800],
        [31.0900, 75.5900],
        [31.0200, 75.7900],
        [31.1200, 75.7800],
        [31.2180, 75.7720],
      ]),
      lengthM: 46000,
    },
    {
      osmWayId: 'kap-way-citycenter',
      name: 'Kapurthala City Center Circular Ring Road',
      roadClass: 'secondary',
      cityTag: 'kapurthala',
      districtId: kapurthala.id,
      coordinates: JSON.stringify([
        [31.3820, 75.3750],
        [31.3850, 75.3830],
        [31.3810, 75.3920],
        [31.3740, 75.3890],
        [31.3720, 75.3800],
        [31.3780, 75.3720],
        [31.3820, 75.3750],
      ]),
      lengthM: 4200,
    },
    {
      osmWayId: 'jal-way-gtroad-bypass',
      name: 'Jalandhar GT Road Expressway Bypass',
      roadClass: 'trunk',
      cityTag: 'jalandhar',
      districtId: jalandhar.id,
      coordinates: JSON.stringify([
        [31.2720, 75.6980],
        [31.2920, 75.6600],
        [31.3080, 75.6200],
        [31.3210, 75.5860],
        [31.3340, 75.5600],
        [31.3500, 75.5350],
      ]),
      lengthM: 11400,
    },
    {
      osmWayId: 'jal-way-modeltown',
      name: 'Model Town Main Commercial Corridor',
      roadClass: 'primary',
      cityTag: 'jalandhar',
      districtId: jalandhar.id,
      coordinates: JSON.stringify([
        [31.3120, 75.5750],
        [31.3170, 75.5780],
        [31.3210, 75.5820],
        [31.3260, 75.5860],
        [31.3310, 75.5900],
      ]),
      lengthM: 2800,
    },
    {
      osmWayId: 'jal-way-cantt',
      name: 'Jalandhar Cantt to Rama Mandi Expressway Corridor',
      roadClass: 'primary',
      cityTag: 'jalandhar',
      districtId: jalandhar.id,
      coordinates: JSON.stringify([
        [31.3000, 75.6100],
        [31.3150, 75.6250],
        [31.3300, 75.6400],
        [31.3500, 75.6300],
      ]),
      lengthM: 8200,
    },
  ];

  
  const NEW_CITY_SEGMENTS = [
    // Delhi NCR
    { osmWayId: 'dl-way-ringroad', name: 'Ring Road', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.58, 77.23], [28.60, 77.25], [28.62, 77.24]]), lengthM: 15000 },
    { osmWayId: 'dl-way-rajpath', name: 'Rajpath / Kartavya Path', roadClass: 'primary', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.61, 77.20], [28.61, 77.22], [28.61, 77.23]]), lengthM: 3000 },
    { osmWayId: 'dl-way-nh44', name: 'NH-44 GT Karnal Road', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.67, 77.19], [28.70, 77.16], [28.75, 77.14]]), lengthM: 12000 },
    { osmWayId: 'dl-way-outer-ring', name: 'Outer Ring Road', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.53, 77.18], [28.54, 77.23], [28.56, 77.26]]), lengthM: 10000 },
    { osmWayId: 'dl-way-ito', name: 'ITO to India Gate corridor', roadClass: 'primary', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.63, 77.24], [28.62, 77.23], [28.61, 77.23]]), lengthM: 4000 },

    // Hyderabad
    { osmWayId: 'hyd-way-pvnr', name: 'PVNR Expressway', roadClass: 'trunk', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.38, 78.45], [17.35, 78.42], [17.32, 78.40]]), lengthM: 11000 },
    { osmWayId: 'hyd-way-hitech', name: 'Hitech City to Gachibowli corridor', roadClass: 'primary', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.44, 78.38], [17.43, 78.36], [17.42, 78.34]]), lengthM: 6000 },
    { osmWayId: 'hyd-way-tankbund', name: 'Tank Bund Road', roadClass: 'primary', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.41, 78.48], [17.42, 78.48], [17.43, 78.48]]), lengthM: 3000 },
    { osmWayId: 'hyd-way-orr', name: 'ORR Shamshabad to Gachibowli', roadClass: 'trunk', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.25, 78.40], [17.30, 78.35], [17.42, 78.34]]), lengthM: 25000 },

    // Chennai
    { osmWayId: 'chn-way-omr', name: 'OMR (Old Mahabalipuram Road)', roadClass: 'trunk', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.00, 80.25], [12.95, 80.24], [12.90, 80.22]]), lengthM: 20000 },
    { osmWayId: 'chn-way-anna', name: 'Anna Salai / Mount Road', roadClass: 'primary', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.07, 80.27], [13.04, 80.25], [13.01, 80.21]]), lengthM: 10000 },
    { osmWayId: 'chn-way-ecr', name: 'ECR East Coast Road', roadClass: 'primary', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[12.98, 80.26], [12.95, 80.25], [12.90, 80.24]]), lengthM: 15000 },
    { osmWayId: 'chn-way-irr', name: 'Inner Ring Road', roadClass: 'trunk', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.10, 80.20], [13.05, 80.19], [13.00, 80.20]]), lengthM: 18000 },

    // Kolkata
    { osmWayId: 'kol-way-embypass', name: 'EM Bypass', roadClass: 'trunk', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.60, 88.40], [22.55, 88.40], [22.50, 88.39]]), lengthM: 20000 },
    { osmWayId: 'kol-way-park', name: 'Park Street corridor', roadClass: 'primary', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.55, 88.35], [22.55, 88.36], [22.55, 88.37]]), lengthM: 3000 },
    { osmWayId: 'kol-way-howrah', name: 'Howrah Bridge / Vidyasagar Setu approach', roadClass: 'trunk', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.58, 88.34], [22.58, 88.33], [22.57, 88.32]]), lengthM: 5000 },
    { osmWayId: 'kol-way-vip', name: 'VIP Road to Airport', roadClass: 'primary', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.59, 88.41], [22.62, 88.42], [22.65, 88.44]]), lengthM: 8000 },

    // Pune
    { osmWayId: 'pun-way-mpe', name: 'Mumbai-Pune Expressway approach', roadClass: 'trunk', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.60, 73.75], [18.65, 73.70], [18.70, 73.65]]), lengthM: 15000 },
    { osmWayId: 'pun-way-fcroad', name: 'FC Road / JM Road', roadClass: 'primary', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.52, 73.84], [18.53, 73.84], [18.53, 73.85]]), lengthM: 2000 },
    { osmWayId: 'pun-way-hinjewadi', name: 'Hinjewadi IT Park Road', roadClass: 'primary', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.58, 73.75], [18.59, 73.73], [18.59, 73.71]]), lengthM: 6000 },
    { osmWayId: 'pun-way-solapur', name: 'Pune-Solapur Highway', roadClass: 'trunk', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.50, 73.90], [18.48, 73.95], [18.45, 74.00]]), lengthM: 12000 },

    // Ahmedabad
    { osmWayId: 'ahm-way-sg', name: 'SG Highway', roadClass: 'trunk', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[23.00, 72.50], [23.05, 72.52], [23.10, 72.54]]), lengthM: 15000 },
    { osmWayId: 'ahm-way-ashram', name: 'Ashram Road', roadClass: 'primary', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[23.01, 72.57], [23.03, 72.57], [23.05, 72.58]]), lengthM: 6000 },
    { osmWayId: 'ahm-way-ring', name: '132ft Ring Road', roadClass: 'trunk', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[23.02, 72.53], [23.05, 72.54], [23.07, 72.56]]), lengthM: 10000 },

    // Jaipur
    { osmWayId: 'jai-way-jln', name: 'JLN Marg', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.85, 75.80], [26.88, 75.81], [26.90, 75.82]]), lengthM: 7000 },
    { osmWayId: 'jai-way-mi', name: 'MI Road', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.91, 75.79], [26.91, 75.80], [26.91, 75.81]]), lengthM: 3000 },
    { osmWayId: 'jai-way-tonk', name: 'Tonk Road', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.80, 75.78], [26.85, 75.79], [26.89, 75.80]]), lengthM: 12000 },

    // Lucknow
    { osmWayId: 'luc-way-shaheed', name: 'Shaheed Path', roadClass: 'trunk', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.78, 80.90], [26.80, 80.95], [26.85, 81.00]]), lengthM: 18000 },
    { osmWayId: 'luc-way-hazrat', name: 'Hazratganj to Charbagh corridor', roadClass: 'primary', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.84, 80.94], [26.83, 80.93], [26.82, 80.92]]), lengthM: 4000 },
    { osmWayId: 'luc-way-faizabad', name: 'Faizabad Road / Sitapur Road', roadClass: 'primary', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.87, 80.95], [26.90, 80.95], [26.95, 80.95]]), lengthM: 10000 },

    // Chandigarh
    { osmWayId: 'cha-way-madhya', name: 'Madhya Marg Sector 9-26', roadClass: 'primary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.74, 76.78], [30.73, 76.79], [30.72, 76.80]]), lengthM: 5000 },
    { osmWayId: 'cha-way-dakshin', name: 'Dakshin Marg', roadClass: 'primary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.72, 76.76], [30.71, 76.78], [30.70, 76.80]]), lengthM: 7000 },
    { osmWayId: 'cha-way-itpark', name: 'IT Park Road', roadClass: 'secondary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.72, 76.82], [30.73, 76.83], [30.74, 76.84]]), lengthM: 4000 },

    // Amritsar
    { osmWayId: 'amr-way-gt', name: 'GT Road', roadClass: 'trunk', cityTag: 'amritsar', districtId: amritsar.id, coordinates: JSON.stringify([[31.60, 74.85], [31.62, 74.87], [31.65, 74.90]]), lengthM: 8000 },
    { osmWayId: 'amr-way-mall', name: 'Mall Road', roadClass: 'primary', cityTag: 'amritsar', districtId: amritsar.id, coordinates: JSON.stringify([[31.63, 74.87], [31.63, 74.88], [31.64, 74.89]]), lengthM: 3000 },
    { osmWayId: 'amr-way-lawrence', name: 'Lawrence Road', roadClass: 'primary', cityTag: 'amritsar', districtId: amritsar.id, coordinates: JSON.stringify([[31.64, 74.87], [31.64, 74.88], [31.65, 74.88]]), lengthM: 2000 },

    // National Highway Corridors
    { osmWayId: 'nat-nh44-del-agra', name: 'NH-44 Delhi to Agra', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[28.61, 77.21], [28.45, 77.30], [28.10, 77.35], [27.60, 77.40], [27.30, 77.50], [27.18, 78.02]]), lengthM: 200000 },
    { osmWayId: 'nat-nh44-blr-hyd', name: 'NH-44 Bangalore to Hyderabad', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[12.97, 77.59], [13.50, 77.60], [14.40, 77.55], [15.35, 78.05], [16.30, 78.30], [17.38, 78.48]]), lengthM: 570000 },
    { osmWayId: 'nat-nh48-del-jai', name: 'NH-48 Delhi to Jaipur', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[28.61, 77.21], [28.45, 76.90], [28.20, 76.50], [27.70, 76.00], [27.20, 75.80], [26.91, 75.79]]), lengthM: 270000 },
    { osmWayId: 'nat-nh8-mum-ahm', name: 'NH-8 Mumbai to Ahmedabad', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[19.08, 72.88], [19.50, 72.95], [20.20, 73.00], [21.00, 73.00], [22.00, 72.70], [23.02, 72.57]]), lengthM: 525000 },
    { osmWayId: 'nat-nh2-del-luc', name: 'NH-2 Delhi to Lucknow', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[28.61, 77.21], [28.67, 77.45], [28.55, 78.00], [28.00, 78.50], [27.50, 79.50], [26.85, 80.95]]), lengthM: 500000 },
    { osmWayId: 'nat-nh16-chn-kol', name: 'NH-16 Chennai to Kolkata', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[13.08, 80.27], [14.50, 80.10], [16.50, 81.80], [17.70, 83.30], [19.80, 85.80], [21.50, 87.00], [22.57, 88.36]]), lengthM: 1600000 },
    { osmWayId: 'nat-nh48-pun-mum', name: 'NH-48 Pune to Mumbai', roadClass: 'trunk', cityTag: 'national', districtId: null, coordinates: JSON.stringify([[18.52, 73.86], [18.60, 73.50], [18.75, 73.30], [18.90, 73.10], [19.08, 72.88]]), lengthM: 150000 },
  ];

  const ALL_DEMO_SEGMENTS = [
    ...NEW_CITY_SEGMENTS,
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

