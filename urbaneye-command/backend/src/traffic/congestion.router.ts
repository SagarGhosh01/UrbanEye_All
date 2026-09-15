/**
 * Congestion Router — Road Segment Congestion Layer API
 * =====================================================
 * Serves real road segment geometry with computed congestion levels.
 * Works with both real VEHICLE_FLOW sensor data (map-matched to nearest segment)
 * and demo mode (scripted scenario player).
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { CongestionLevel } from './bangalore-demo-scenario.js';

const prisma = new PrismaClient();
export const congestionRouter = Router();

// ─── In-Memory Congestion State ──────────────────────────────────────────────
// Maps segmentId → current congestion level + score
export interface SegmentCongestion {
  segmentId: string;
  level: CongestionLevel;
  score: number; // 0-100
  updatedAt: number; // epoch ms
}

// Global mutable congestion state — updated by real-time engine or demo player
const congestionState = new Map<string, SegmentCongestion>();

/**
 * Where the congestion figures currently on display came from.
 *
 * This travels with the data to the client so the map can label a scripted scenario
 * as scripted. An overlay animating across real OSM geometry is indistinguishable
 * from measured traffic unless we say which it is, and a viewer who assumes the
 * wrong one is being misled by omission.
 */
export type CongestionSource = 'SCRIPTED_DEMO' | 'FLEET_OBSERVATIONS' | 'NONE';

let congestionSource: CongestionSource = 'NONE';

export function getCongestionSource(): CongestionSource {
  return congestionState.size === 0 ? 'NONE' : congestionSource;
}

/**
 * Update congestion state for a batch of segments.
 * Called by both the real-time aggregation engine and the demo player; the caller
 * must declare which it is, so provenance cannot drift away from the data.
 */
export function updateCongestionState(updates: SegmentCongestion[], source: CongestionSource): void {
  congestionSource = source;
  for (const update of updates) {
    congestionState.set(update.segmentId, update);
  }
}

/**
 * Get all current congestion states
 */
export function getAllCongestionState(): SegmentCongestion[] {
  return Array.from(congestionState.values());
}

/**
 * Clear all congestion state (used when stopping demo mode)
 */
export function clearCongestionState(): void {
  congestionState.clear();
  congestionSource = 'NONE';
}

// ─── Congestion Color/Level Mapping ──────────────────────────────────────────
export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  FREE_FLOW: '#16a34a',
  MODERATE: '#d97706',
  HEAVY: '#dc2626',
  SEVERE: '#7f1d1d',
};

export function scoreToLevel(score: number): CongestionLevel {
  if (score >= 85) return 'SEVERE';
  if (score >= 60) return 'HEAVY';
  if (score >= 30) return 'MODERATE';
  return 'FREE_FLOW';
}

// ─── Haversine Distance ──────────────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the nearest road segment to a given GPS point within threshold.
 * Returns the segment ID or null if none found within 30m.
 */
export async function snapToNearestSegment(
  lat: number,
  lon: number,
  cityTag: string = 'bangalore',
  thresholdM: number = 30
): Promise<string | null> {
  const segments = await prisma.roadSegment.findMany({
    where: { cityTag },
    select: { id: true, coordinates: true },
  });

  let nearestId: string | null = null;
  let nearestDist = Infinity;

  for (const seg of segments) {
    const coords: [number, number][] = JSON.parse(seg.coordinates);
    for (const [segLat, segLon] of coords) {
      const dist = haversineDistance(lat, lon, segLat, segLon);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = seg.id;
      }
    }
  }

  return nearestDist <= thresholdM ? nearestId : null;
}

// ─── REST API Endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/traffic/segments?city=bangalore
 * Returns all road segments with their geometry
 */
congestionRouter.get('/segments', async (req, res) => {
  try {
    const city = (req.query.city as string) || 'bangalore';
    const segments = await prisma.roadSegment.findMany({
      where: { cityTag: city },
      select: {
        id: true,
        osmWayId: true,
        name: true,
        roadClass: true,
        coordinates: true,
        lengthM: true,
      },
    });

    // Parse coordinates from JSON strings
    const parsed = segments.map((s) => ({
      ...s,
      coordinates: JSON.parse(s.coordinates) as [number, number][],
    }));

    res.json({
      status: 'SUCCESS',
      city,
      count: parsed.length,
      segments: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Failed to fetch road segments:', err.message);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

/**
 * GET /api/traffic/congestion-state?city=bangalore
 * Returns current congestion level + color for each segment
 */
congestionRouter.get('/congestion-state', async (req, res) => {
  try {
    const city = (req.query.city as string) || 'bangalore';

    // Get all segments for this city
    const segments = await prisma.roadSegment.findMany({
      where: { cityTag: city },
      select: { id: true, name: true, roadClass: true, coordinates: true },
    });

    // Merge with in-memory congestion state
    const result = segments.map((seg) => {
      const state = congestionState.get(seg.id);
      const level: CongestionLevel = state?.level || 'FREE_FLOW';
      return {
        segmentId: seg.id,
        name: seg.name,
        roadClass: seg.roadClass,
        level,
        color: CONGESTION_COLORS[level],
        score: state?.score ?? 0,
        coordinates: JSON.parse(seg.coordinates) as [number, number][],
        updatedAt: state?.updatedAt ? new Date(state.updatedAt).toISOString() : null,
      };
    });

    res.json({
      status: 'SUCCESS',
      city,
      count: result.length,
      congestion: result,
      // 'SCRIPTED_DEMO' means these levels come from a scenario script, not from
      // buses. The dashboard must surface this — see the map's data-source badge.
      dataSource: getCongestionSource(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Failed to fetch congestion state:', err.message);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

/**
 * GET /api/traffic/congestion-summary?city=bangalore
 * Aggregate stats for the traffic panel
 */
congestionRouter.get('/congestion-summary', async (req, res) => {
  const states = getAllCongestionState();
  const total = states.length;
  const counts = { FREE_FLOW: 0, MODERATE: 0, HEAVY: 0, SEVERE: 0 };
  for (const s of states) {
    counts[s.level] = (counts[s.level] || 0) + 1;
  }

  res.json({
    status: 'SUCCESS',
    summary: {
      totalSegments: total,
      freeFlow: counts.FREE_FLOW,
      moderate: counts.MODERATE,
      heavy: counts.HEAVY,
      severe: counts.SEVERE,
      avgScore: total > 0 ? Math.round(states.reduce((a, b) => a + b.score, 0) / total) : 0,
    },
    timestamp: new Date().toISOString(),
  });
});
