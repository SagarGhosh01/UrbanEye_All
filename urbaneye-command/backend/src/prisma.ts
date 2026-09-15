import dotenv from 'dotenv';
import path from 'path';
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
 * and seeds the initial administrative hierarchy + road defects.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  try {
    // Probe database schema using District table lookup
    await prisma.district.findFirst();
  } catch (err: any) {
    if (err?.code === 'P2021' || (err?.message && (err.message.includes('does not exist') || err.message.includes('P2021')))) {
      console.warn('⚠️ [Database Notice] Database tables missing (P2021). Executing self-healing DB migration & seed...');
      try {
        const backendDir = path.resolve(__dirname, '..');
        execSync('npx prisma db push --accept-data-loss', {
          cwd: backendDir,
          stdio: 'inherit',
          env: process.env,
        });
        console.log('✅ Schema pushed successfully! Executing database seed script...');
        execSync('npx tsx prisma/seed.ts', {
          cwd: backendDir,
          stdio: 'inherit',
          env: process.env,
        });
        console.log('🌱 Database seeded successfully!');
      } catch (execErr: any) {
        console.error('❌ Automatic DB migration failed:', execErr?.message || execErr);
      }
    }
  }
}
