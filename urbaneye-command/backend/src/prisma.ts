import dotenv from 'dotenv';
import path from 'path';
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
