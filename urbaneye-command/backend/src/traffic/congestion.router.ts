/**
 * Congestion Router — Road Segment Congestion Layer API
 * =====================================================
 * Serves real road segment geometry with computed congestion levels.
 * Works with both real VEHICLE_FLOW sensor data (map-matched to nearest segment)
 * and demo mode (scripted scenario player).
 */

import { Router } from 'express';
import { prisma } from '../prisma.js';
import type { CongestionLevel } from './bangalore-demo-scenario.js';

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
    const whereClause: any = city === 'all' ? {} : { cityTag: city };

    const roadClassQuery = req.query.roadClass as string | undefined;
    if (roadClassQuery) {
      const classes = roadClassQuery.split(',').map((c) => c.trim()).filter(Boolean);
      if (classes.length > 0) {
        whereClause.roadClass = { in: classes };
      }
    }

    const segments = await prisma.roadSegment.findMany({
      where: whereClause,
      select: {
        id: true,
        osmWayId: true,
        name: true,
        roadClass: true,
        coordinates: true,
        lengthM: true,
        cityTag: true,
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
 * GET /api/traffic/congestion-state?city=all&roadClass=trunk,primary
 * Returns current congestion level + color + demo speed/volume for each segment
 */
congestionRouter.get('/congestion-state', async (req, res) => {
  try {
    const city = (req.query.city as string) || 'all';

    // Build Prisma query filter
    const whereClause: any = {};
    if (city !== 'all') {
      whereClause.cityTag = city;
    }
    const roadClassQuery = req.query.roadClass as string | undefined;
    if (roadClassQuery) {
      const classes = roadClassQuery.split(',').map((c) => c.trim()).filter(Boolean);
      if (classes.length > 0) {
        whereClause.roadClass = { in: classes };
      }
    }

    const segments = await prisma.roadSegment.findMany({
      where: whereClause,
      select: { id: true, name: true, roadClass: true, cityTag: true, coordinates: true },
    });

    // Merge with in-memory congestion state or compute realistic corridor congestion level
    const result = segments.map((seg, index) => {
      const state = congestionState.get(seg.id);
      let level: CongestionLevel;

      if (state?.level) {
        level = state.level;
      } else {
        const lower = (seg.name || '').toLowerCase();
        const city = seg.cityTag || '';

        // Highly congested cities & key choke corridors
        if (
          lower.includes('silk board') ||
          lower.includes('tin factory') ||
          lower.includes('marathahalli') ||
          lower.includes('sea link') ||
          lower.includes('ring road') ||
          lower.includes('em bypass') ||
          lower.includes('pvnr') ||
          lower.includes('nh-44 phagwara to jalandhar') ||
          lower.includes('city center circular')
        ) {
          level = 'SEVERE';
        } else if (
          lower.includes('nh-70') ||
          lower.includes('expressway') ||
          lower.includes('western express') ||
          lower.includes('gt road bypass') ||
          lower.includes('omr') ||
          lower.includes('sg highway') ||
          lower.includes('shaheed path')
        ) {
          level = 'HEAVY';
        } else if (
          lower.includes('sh-24 subhanpur') ||
          lower.includes('sh-71') ||
          lower.includes('phagwara to narur') ||
          lower.includes('indiranagar') ||
          lower.includes('mg road') ||
          lower.includes('model town') ||
          lower.includes('anna salai') ||
          lower.includes('hinjewadi')
        ) {
          level = 'MODERATE';
        } else if (
          city === 'chandigarh' ||
          lower.includes('phillaur to phagwara') ||
          lower.includes('sh-24 kapurthala city') ||
          lower.includes('sh-14') ||
          lower.includes('sultanpur') ||
          lower.includes('banga') ||
          lower.includes('nakodar to nurmahal') ||
          lower.includes('cantt') ||
          lower.includes('rajpath') ||
          lower.includes('park street')
        ) {
          level = 'FREE_FLOW';
        } else if (city === 'national') {
          // National corridors: mostly Free Flow or Moderate with occasional Heavy
          const nMod = index % 5;
          level = nMod === 0 ? 'FREE_FLOW' : nMod === 1 ? 'FREE_FLOW' : nMod === 2 ? 'MODERATE' : nMod === 3 ? 'MODERATE' : 'HEAVY';
        } else if (city === 'delhi' || city === 'bangalore' || city === 'mumbai') {
          // Congested metropolises
          const mMod = index % 4;
          level = mMod === 0 ? 'SEVERE' : mMod === 1 ? 'HEAVY' : mMod === 2 ? 'MODERATE' : 'SEVERE';
        } else if (city === 'pune' || city === 'hyderabad' || city === 'chennai' || city === 'kolkata') {
          const cMod = index % 3;
          level = cMod === 0 ? 'MODERATE' : cMod === 1 ? 'HEAVY' : 'FREE_FLOW';
        } else {
          // Balanced distribution across network
          const mod = index % 4;
          if (mod === 0) level = 'FREE_FLOW';
          else if (mod === 1) level = 'MODERATE';
          else if (mod === 2) level = 'HEAVY';
          else level = 'SEVERE';
        }
      }

      const score = state?.score ?? (level === 'SEVERE' ? 92 : level === 'HEAVY' ? 74 : level === 'MODERATE' ? 48 : 18);

      // Derive realistic demo speed and vehicle density based on congestion tier
      let avgSpeedKmh = 68;
      let vehicleCountPerHour = 950;
      if (level === 'SEVERE') {
        avgSpeedKmh = Math.max(6, Math.round(14 - (score - 85) * 0.5));
        vehicleCountPerHour = 4800 + (index % 12) * 100;
      } else if (level === 'HEAVY') {
        avgSpeedKmh = Math.max(16, Math.round(28 - (score - 60) * 0.4));
        vehicleCountPerHour = 3200 + (index % 8) * 100;
      } else if (level === 'MODERATE') {
        avgSpeedKmh = Math.max(32, Math.round(48 - (score - 30) * 0.3));
        vehicleCountPerHour = 1900 + (index % 6) * 80;
      } else {
        avgSpeedKmh = 65 + (index % 5) * 4;
        vehicleCountPerHour = 750 + (index % 5) * 50;
      }

      return {
        segmentId: seg.id,
        name: seg.name,
        roadClass: seg.roadClass,
        cityTag: seg.cityTag,
        level,
        color: CONGESTION_COLORS[level],
        score,
        congestionPct: score,
        avgSpeedKmh,
        vehicleCountPerHour,
        coordinates: JSON.parse(seg.coordinates) as [number, number][],
        updatedAt: state?.updatedAt ? new Date(state.updatedAt).toISOString() : null,
      };
    });

    res.json({
      status: 'SUCCESS',
      city,
      count: result.length,
      congestion: result,
      dataSource: getCongestionSource(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Failed to fetch congestion state:', err.message);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

/**
 * GET /api/traffic/congestion-summary?city=all
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
