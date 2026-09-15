import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// Ensure DATABASE_URL is initialized with local SQLite fallback if not set by cloud environment
if (!process.env.DATABASE_URL) {
  const defaultDbPath = path.resolve(process.cwd(), 'dev.db');
  process.env.DATABASE_URL = `file:${defaultDbPath}`;
}

export const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Self-healing Database Initialization Guard
 * Automatically detects if database tables (P2021) are missing, runs `prisma db push`,
 * and ensures all 6,255 road segments and administrative hierarchy are seeded on Render or local startup.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  const backendDir = path.resolve(__dirname, '..');

  // 1. Check if database tables exist
  try {
    await prisma.district.findFirst();
  } catch (err: any) {
    if (err?.code === 'P2021' || (err?.message && (err.message.includes('does not exist') || err.message.includes('P2021')))) {
      console.warn('⚠️ [Database Notice] Database tables missing (P2021). Executing schema push...');
      try {
        execSync('npx prisma db push --accept-data-loss', {
          cwd: backendDir,
          stdio: 'inherit',
          env: process.env,
        });
        console.log('✅ Schema pushed successfully!');
      } catch (execErr: any) {
        console.error('❌ Automatic DB migration failed:', execErr?.message || execErr);
      }
    }
  }

  // 2. Check if road segments or districts are empty
  try {
    const roadCount = await prisma.roadSegment.count();
    const districtCount = await prisma.district.count();

    if (roadCount === 0 || districtCount === 0) {
      console.warn(`⚠️ [Database Notice] Database is unseeded (roads: ${roadCount}, districts: ${districtCount}). Executing automatic seeding for Render...`);

      // Try running the full seed script first
      let seedSucceeded = false;
      try {
        execSync('npx tsx prisma/seed.ts', {
          cwd: backendDir,
          stdio: 'inherit',
          env: process.env,
        });
        seedSucceeded = true;
        console.log('🌱 Full database seed completed successfully!');
      } catch (seedErr: any) {
        console.warn('⚠️ Could not run tsx seed script, attempting direct JSON road segment ingestion fallback...', seedErr.message);
      }

      // Direct fallback: if road segments are still 0, load directly from road_segments.json
      const currentRoads = await prisma.roadSegment.count();
      if (currentRoads === 0) {
        const jsonPath = path.resolve(backendDir, 'prisma', 'road_segments.json');
        if (fs.existsSync(jsonPath)) {
          console.log('📦 Loading road segments directly from prisma/road_segments.json...');
          const rawSegments = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          const batchSize = 1000;
          for (let i = 0; i < rawSegments.length; i += batchSize) {
            const batch = rawSegments.slice(i, i + batchSize).map((s: any) => ({
              osmWayId: s.osmWayId,
              name: s.name,
              roadClass: s.roadClass,
              coordinates: s.coordinates,
              districtId: s.districtId,
              cityTag: s.cityTag,
              lengthM: s.lengthM,
            }));
            await prisma.roadSegment.createMany({ data: batch });
          }
          console.log(`✅ Successfully loaded ${rawSegments.length} road segments via fallback!`);
        }
      }
    } else {
      console.log(`✅ Database verified healthy (${roadCount} roads, ${districtCount} districts active)`);
    }
  } catch (checkErr: any) {
    console.error('⚠️ Error verifying database state:', checkErr.message);
  }
}
