import fs from 'fs';
import path from 'path';
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
  const defaultPassword = 'SRIMS@2026';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // 3. Create Hierarchical Accounts
  const admin = await prisma.user.create({
    data: {
      id: 'usr-admin-national',
      email: 'admin@srims.gov.in',
      passwordHash,
      name: 'Shri Rajesh Verma (MoRTH Director)',
      role: 'NATIONAL_ADMIN',
    },
  });

  const statePb = await prisma.user.create({
    data: {
      id: 'usr-admin-pb',
      email: 'admin.pb@srims.gov.in',
      passwordHash,
      name: 'S. Harpreet Singh (Punjab PWD Chief Engineer)',
      role: 'STATE_ADMIN',
      stateId: pb.id,
    },
  });

  const headKapurthala = await prisma.user.create({
    data: {
      id: 'usr-kapurthala-1',
      email: 'head.kapurthala@srims.gov.in',
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
      email: 'head.jalandhar@srims.gov.in',
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
      email: 'head.bengaluru@srims.gov.in',
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
      email: 'head.mumbai@srims.gov.in',
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
    // Delhi NCR (DL)
    { osmWayId: 'dl-way-ringroad', name: 'Ring Road Expressway (AIIMS to Dhaula Kuan)', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.5672, 77.2100], [28.5780, 77.2250], [28.5920, 77.2400], [28.6100, 77.2450], [28.6300, 77.2400], [28.6500, 77.2200]]), lengthM: 18000 },
    { osmWayId: 'dl-way-rajpath', name: 'Kartavya Path / Rajpath Boulevard', roadClass: 'primary', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.6142, 77.1990], [28.6139, 77.2090], [28.6135, 77.2190], [28.6130, 77.2290]]), lengthM: 3200 },
    { osmWayId: 'dl-way-nh44', name: 'NH-44 GT Karnal Road Expressway', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.6720, 77.1950], [28.7050, 77.1680], [28.7520, 77.1420], [28.8100, 77.1150]]), lengthM: 16000 },
    { osmWayId: 'dl-way-outer-ring', name: 'Outer Ring Road (IIT Flyover to Paschim Vihar)', roadClass: 'trunk', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.5420, 77.1890], [28.5510, 77.2250], [28.5680, 77.2620], [28.6100, 77.2850]]), lengthM: 14000 },
    { osmWayId: 'dl-way-ito', name: 'ITO Junction & Pragati Maidan Corridor', roadClass: 'primary', cityTag: 'delhi', districtId: newDelhi.id, coordinates: JSON.stringify([[28.6295, 77.2435], [28.6240, 77.2400], [28.6180, 77.2350], [28.6130, 77.2290]]), lengthM: 4500 },

    // Hyderabad (Telangana - TG)
    { osmWayId: 'hyd-way-pvnr', name: 'PVNR Elevated Expressway', roadClass: 'trunk', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.3850, 78.4520], [17.3620, 78.4350], [17.3380, 78.4180], [17.3150, 78.4020]]), lengthM: 11600 },
    { osmWayId: 'hyd-way-hitech', name: 'Hitech City IT Main Road & Gachibowli Flyover', roadClass: 'primary', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.4520, 78.3880], [17.4435, 78.3772], [17.4310, 78.3620], [17.4200, 78.3480]]), lengthM: 7200 },
    { osmWayId: 'hyd-way-tankbund', name: 'Tank Bund Road & Hussain Sagar Drive', roadClass: 'primary', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.4120, 78.4780], [17.4220, 78.4820], [17.4350, 78.4850]]), lengthM: 3500 },
    { osmWayId: 'hyd-way-orr', name: 'ORR Outer Ring Road Expressway', roadClass: 'trunk', cityTag: 'hyderabad', districtId: hyderabad.id, coordinates: JSON.stringify([[17.2450, 78.4100], [17.3020, 78.3650], [17.4200, 78.3480], [17.4950, 78.3820]]), lengthM: 28000 },

    // Chennai (Tamil Nadu - TN)
    { osmWayId: 'chn-way-omr', name: 'OMR Rajiv Gandhi Salai IT Expressway', roadClass: 'trunk', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.0080, 80.2520], [12.9650, 80.2450], [12.9210, 80.2320], [12.8750, 80.2180]]), lengthM: 22000 },
    { osmWayId: 'chn-way-anna', name: 'Anna Salai / Mount Road Central Arterial', roadClass: 'primary', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.0827, 80.2707], [13.0604, 80.2496], [13.0320, 80.2280], [13.0080, 80.2050]]), lengthM: 12000 },
    { osmWayId: 'chn-way-ecr', name: 'ECR East Coast Road Scenic Highway', roadClass: 'primary', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[12.9820, 80.2610], [12.9450, 80.2520], [12.8980, 80.2410], [12.8450, 80.2310]]), lengthM: 18000 },
    { osmWayId: 'chn-way-irr', name: 'Inner Ring Road (Koyambedu to Kathipara)', roadClass: 'trunk', cityTag: 'chennai', districtId: chennai.id, coordinates: JSON.stringify([[13.1020, 80.2080], [13.0680, 80.1980], [13.0250, 80.2050], [12.9980, 80.2010]]), lengthM: 16500 },

    // Kolkata (West Bengal - WB)
    { osmWayId: 'kol-way-embypass', name: 'EM Bypass (Eastern Metropolitan Bypass)', roadClass: 'trunk', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.6100, 88.4080], [22.5620, 88.4020], [22.5354, 88.3968], [22.4850, 88.3910]]), lengthM: 21000 },
    { osmWayId: 'kol-way-park', name: 'Park Street & Camac Street Avenue', roadClass: 'primary', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.5520, 88.3480], [22.5510, 88.3590], [22.5500, 88.3710]]), lengthM: 3200 },
    { osmWayId: 'kol-way-howrah', name: 'Howrah Bridge / Vidyasagar Setu Approach', roadClass: 'trunk', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.5850, 88.3420], [22.5780, 88.3320], [22.5650, 88.3240]]), lengthM: 5400 },
    { osmWayId: 'kol-way-vip', name: 'VIP Road to Airport Express Corridor', roadClass: 'primary', cityTag: 'kolkata', districtId: kolkata.id, coordinates: JSON.stringify([[22.5920, 88.4120], [22.6240, 88.4280], [22.6510, 88.4450]]), lengthM: 8800 },

    // Pune (Maharashtra - MH)
    { osmWayId: 'pun-way-mpe', name: 'Mumbai-Pune Expressway Highway Approach', roadClass: 'trunk', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.6020, 73.7550], [18.6480, 73.7020], [18.6980, 73.6520]]), lengthM: 16000 },
    { osmWayId: 'pun-way-fcroad', name: 'FC Road / JM Road Heritage Corridor', roadClass: 'primary', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.5180, 73.8410], [18.5280, 73.8440], [18.5360, 73.8490]]), lengthM: 2400 },
    { osmWayId: 'pun-way-hinjewadi', name: 'Hinjewadi IT Park Main Expressway', roadClass: 'primary', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.5590, 73.7868], [18.5850, 73.7480], [18.5980, 73.7120]]), lengthM: 8500 },
    { osmWayId: 'pun-way-solapur', name: 'Pune-Solapur Highway (Hadapsar Corridor)', roadClass: 'trunk', cityTag: 'pune', districtId: pune.id, coordinates: JSON.stringify([[18.5020, 73.9020], [18.4810, 73.9520], [18.4520, 74.0050]]), lengthM: 13500 },

    // Ahmedabad (Gujarat - GJ)
    { osmWayId: 'ahm-way-sg', name: 'SG Highway (Sarkhej-Gandhinagar Expressway)', roadClass: 'trunk', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[22.9850, 72.4950], [23.0225, 72.5180], [23.0780, 72.5350], [23.1250, 72.5520]]), lengthM: 18000 },
    { osmWayId: 'ahm-way-ashram', name: 'Ashram Road & Sabarmati Riverfront Drive', roadClass: 'primary', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[23.0110, 72.5680], [23.0320, 72.5714], [23.0580, 72.5790]]), lengthM: 6800 },
    { osmWayId: 'ahm-way-ring', name: '132ft Inner Ring Road (Satellite to Naranpura)', roadClass: 'trunk', cityTag: 'ahmedabad', districtId: ahmedabad.id, coordinates: JSON.stringify([[23.0180, 72.5280], [23.0480, 72.5420], [23.0720, 72.5610]]), lengthM: 11200 },

    // Jaipur (Rajasthan - RJ)
    { osmWayId: 'jai-way-jln', name: 'JLN Marg (Jawaharlal Nehru Marg Avenue)', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.8380, 75.8080], [26.8560, 75.8110], [26.8780, 75.8150], [26.8940, 75.8120]]), lengthM: 7500 },
    { osmWayId: 'jai-way-mi', name: 'MI Road (Mirza Ismail Road Central Corridor)', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9124, 75.7873], [26.9140, 75.7980], [26.9150, 75.8080]]), lengthM: 3500 },
    { osmWayId: 'jai-way-tonk', name: 'Tonk Road & Tonk Phatak Main Highway Corridor', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.8300, 75.7940], [26.8520, 75.7980], [26.8750, 75.8010], [26.8950, 75.8040]]), lengthM: 12800 },
    { osmWayId: 'jai-way-ajmer', name: 'Ajmer Road Expressway (Sodala / Hawa Sadak)', roadClass: 'trunk', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9080, 75.7650], [26.9040, 75.7780], [26.8990, 75.7920], [26.8940, 75.8050]]), lengthM: 8500 },
    { osmWayId: 'jai-way-bais-godam', name: 'Bais Godam & Kartarpura Railway Overbridge Corridor', roadClass: 'secondary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.8920, 75.7910], [26.8820, 75.7930], [26.8720, 75.7940]]), lengthM: 3200 },
    { osmWayId: 'jai-way-bani-park', name: 'Bani Park & Meera Marg Sector Boulevard', roadClass: 'secondary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9320, 75.7920], [26.9260, 75.7980], [26.9200, 75.8020]]), lengthM: 2800 },
    { osmWayId: 'jai-way-ramganj-amer', name: 'Ramganj & Amer Road Highway (NH-248 Corridor)', roadClass: 'primary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9240, 75.8320], [26.9450, 75.8450], [26.9700, 75.8580]]), lengthM: 7800 },
    { osmWayId: 'jai-way-sikar-cantt', name: 'Sikar Road & Jaipur Cantonment Bypass', roadClass: 'trunk', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9380, 75.7820], [26.9550, 75.7780], [26.9750, 75.7720]]), lengthM: 6400 },
    { osmWayId: 'jai-way-khatipura-sirsi', name: 'Khatipura Road & Sirsi Road Residential Arterial', roadClass: 'secondary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9180, 75.7520], [26.9120, 75.7350], [26.9080, 75.7180]]), lengthM: 5200 },
    { osmWayId: 'jai-way-vaishali-nh48', name: 'Vaishali Nagar & NH-48 / NH-52 Jaipur Bypass', roadClass: 'trunk', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.9080, 75.7380], [26.8920, 75.7280], [26.8750, 75.7200]]), lengthM: 9200 },
    { osmWayId: 'jai-way-shanti-path', name: 'Shanti Path & Adarsh Nagar Commercial Avenue', roadClass: 'secondary', cityTag: 'jaipur', districtId: jaipur.id, coordinates: JSON.stringify([[26.8950, 75.8220], [26.8820, 75.8280], [26.8680, 75.8320]]), lengthM: 4100 },

    // Lucknow (Uttar Pradesh - UP)
    { osmWayId: 'luc-way-shaheed', name: 'Shaheed Path Outer Ring Expressway', roadClass: 'trunk', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.7820, 80.9020], [26.8050, 80.9520], [26.8467, 80.9462], [26.8850, 81.0120]]), lengthM: 19500 },
    { osmWayId: 'luc-way-hazrat', name: 'Hazratganj to Charbagh Central Corridor', roadClass: 'primary', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.8467, 80.9462], [26.8350, 80.9320], [26.8210, 80.9200]]), lengthM: 4800 },
    { osmWayId: 'luc-way-faizabad', name: 'Faizabad Road & Gomti Nagar Extension Expressway', roadClass: 'primary', cityTag: 'lucknow', districtId: lucknow.id, coordinates: JSON.stringify([[26.8720, 80.9580], [26.9020, 80.9750], [26.9450, 81.0020]]), lengthM: 11500 },

    // Chandigarh UT (CH)
    { osmWayId: 'cha-way-madhya', name: 'Madhya Marg (Sector 9 to Sector 26 Avenue)', roadClass: 'primary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.7480, 76.7720], [30.7333, 76.7794], [30.7210, 76.8020]]), lengthM: 5800 },
    { osmWayId: 'cha-way-dakshin', name: 'Dakshin Marg (Tribune Chowk Highway Corridor)', roadClass: 'primary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.7250, 76.7550], [30.7120, 76.7780], [30.7010, 76.8050]]), lengthM: 7600 },
    { osmWayId: 'cha-way-itpark', name: 'IT Park Road & Kishangarh Sector Corridor', roadClass: 'secondary', cityTag: 'chandigarh', districtId: chandigarhDist.id, coordinates: JSON.stringify([[30.7220, 76.8180], [30.7350, 76.8320], [30.7450, 76.8480]]), lengthM: 4400 },

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

  // Always seed explicit high-fidelity demo corridors first
  for (const seg of ALL_DEMO_SEGMENTS) {
    try {
      await prisma.roadSegment.create({ data: seg });
    } catch (e) {
      // Ignore duplicates if any
    }
  }

  const jsonPath = path.resolve(__dirname, 'road_segments.json');
  if (fs.existsSync(jsonPath)) {
    console.log('📦 Loading pre-computed road segments from road_segments.json...');
    const rawSegments = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const batchSize = 1000;
    for (let i = 0; i < rawSegments.length; i += batchSize) {
      const batch = rawSegments.slice(i, i + batchSize).map((s) => ({
        osmWayId: s.osmWayId,
        name: s.name,
        roadClass: s.roadClass,
        coordinates: s.coordinates,
        districtId: s.districtId,
        cityTag: s.cityTag,
        lengthM: s.lengthM,
      }));
      try {
        await prisma.roadSegment.createMany({ data: batch });
      } catch (e) {
        // Continue if batch has overlap
      }
    }
    console.log(`✅ Successfully seeded ${rawSegments.length} road segments across Punjab and India!`);
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
  console.log('   - Bangalore: head.bengaluru@srims.gov.in / SRIMS@2026');
  console.log('   - Mumbai: head.mumbai@srims.gov.in / SRIMS@2026');
  console.log('   - Kapurthala: head.kapurthala@srims.gov.in / SRIMS@2026');
  console.log('   - Jalandhar: head.jalandhar@srims.gov.in / SRIMS@2026');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

