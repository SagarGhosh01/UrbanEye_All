/**
 * Demo Player — Bangalore Traffic Congestion Scenario
 * ====================================================
 * Reads the scripted bangalore-demo-scenario and pushes congestion updates
 * over Socket.IO on the SAME channel that real sensor data would use.
 *
 * The frontend doesn't need any demo-specific rendering logic — it just
 * receives real-shaped events.
 *
 * Activated when:
 *   1. DEMO_MODE=bangalore env var is set (auto-start on server boot)
 *   2. Backend receives 'demo:start' socket event (on-demand from frontend)
 */

import { PrismaClient } from '@prisma/client';
import {
  BANGALORE_CORRIDORS,
  getCurrentPhase,
  addVariation,
  DEMO_DEFECT_MARKERS,
  DEMO_BUS_ROUTES,
  LOOP_DURATION_SECONDS,
  type CongestionLevel,
} from './bangalore-demo-scenario.js';
import {
  updateCongestionState,
  clearCongestionState,
  type SegmentCongestion,
} from './congestion.router.js';
import { getIO } from '../realtime/socket.js';

const prisma = new PrismaClient();

// ─── State ───────────────────────────────────────────────────────────────────
let demoInterval: ReturnType<typeof setInterval> | null = null;
let demoStartTime = 0;
let isRunning = false;
let busPositionIndices: number[] = []; // Current waypoint index for each bus

// ─── Haversine ───────────────────────────────────────────────────────────────
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

// ─── Level to Score ──────────────────────────────────────────────────────────
function levelToScore(level: CongestionLevel): number {
  const baseScores: Record<CongestionLevel, number> = {
    FREE_FLOW: 15,
    MODERATE: 45,
    HEAVY: 72,
    SEVERE: 92,
  };
  // Add ±5 random variation
  return Math.max(0, Math.min(100, baseScores[level] + Math.floor(Math.random() * 11) - 5));
}

/**
 * Match a road segment against the corridor patterns to determine its
 * congestion level for the current phase.
 */
function matchSegmentToCorridor(
  segName: string | null,
  segCoords: [number, number][],
  phase: number
): CongestionLevel {
  // Try name matching first
  if (segName) {
    const lowerName = segName.toLowerCase();
    for (const corridor of BANGALORE_CORRIDORS) {
      for (const pattern of corridor.namePatterns) {
        if (lowerName.includes(pattern)) {
          return addVariation(corridor.phases[phase]);
        }
      }
    }
  }

  // Fall back to proximity matching (check if any segment coordinate
  // is within an anchor's radius)
  const segMidpoint = segCoords[Math.floor(segCoords.length / 2)];
  for (const corridor of BANGALORE_CORRIDORS) {
    for (const anchor of corridor.anchors) {
      const dist = haversineDistance(segMidpoint[0], segMidpoint[1], anchor.lat, anchor.lon);
      if (dist <= anchor.radiusM) {
        return addVariation(corridor.phases[phase]);
      }
    }
  }

  // Default: unmatched segments get mild variation between FREE_FLOW and MODERATE
  const rand = Math.random();
  if (rand < 0.70) return 'FREE_FLOW';
  if (rand < 0.90) return 'MODERATE';
  return 'FREE_FLOW';
}

/**
 * Advance simulated bus positions and emit their GPS as "bus:position" events
 */
function emitBusPositions(): void {
  const io = getIO();
  if (!io) return;

  for (let i = 0; i < DEMO_BUS_ROUTES.length; i++) {
    const bus = DEMO_BUS_ROUTES[i];
    const wpIdx = busPositionIndices[i] % bus.waypoints.length;
    const wp = bus.waypoints[wpIdx];

    // Add small GPS jitter for realism
    const lat = wp.lat + (Math.random() - 0.5) * 0.0005;
    const lon = wp.lon + (Math.random() - 0.5) * 0.0005;

    io.emit('bus:position', {
      busLabel: bus.busLabel,
      routeTag: bus.routeTag,
      latitude: lat,
      longitude: lon,
      speed: 15 + Math.random() * 25,
      heading: Math.random() * 360,
      timestamp: new Date().toISOString(),
      isDemo: true,
    });

    // Advance to next waypoint
    busPositionIndices[i] = (busPositionIndices[i] + 1) % bus.waypoints.length;
  }
}

/**
 * Emit demo defect markers (once on startup, not every tick)
 */
function emitDemoDefects(): void {
  const io = getIO();
  if (!io) return;

  for (const defect of DEMO_DEFECT_MARKERS) {
    io.emit('event:new', {
      id: `demo-defect-${Math.random().toString(36).slice(2, 10)}`,
      type: defect.type,
      confidence: defect.confidence,
      latitude: defect.lat,
      longitude: defect.lon,
      severity: defect.severity,
      busLabel: defect.busLabel,
      status: 'NEW',
      source: 'Transit Bus Fleet',
      timestamp: new Date().toISOString(),
      isDemo: true,
    });
  }
}

/**
 * Core demo tick — runs every 3 seconds.
 * Computes current phase, assigns congestion levels, and pushes updates.
 */
async function demoTick(): Promise<void> {
  const io = getIO();
  if (!io) return;

  const elapsed = (Date.now() - demoStartTime) / 1000;
  const phase = getCurrentPhase(elapsed);

  try {
    // Fetch all Bangalore segments from DB
    const segments = await prisma.roadSegment.findMany({
      where: { cityTag: 'bangalore' },
      select: { id: true, name: true, coordinates: true },
    });

    if (segments.length === 0) {
      console.warn('[DEMO] No road segments found for bangalore — run the ingestion script first');
      return;
    }

    // Compute congestion level for each segment
    const updates: SegmentCongestion[] = segments.map((seg) => {
      const coords: [number, number][] = JSON.parse(seg.coordinates);
      const level = matchSegmentToCorridor(seg.name, coords, phase);
      return {
        segmentId: seg.id,
        level,
        score: levelToScore(level),
        updatedAt: Date.now(),
      };
    });

    // Update global congestion state
    updateCongestionState(updates, 'SCRIPTED_DEMO');

    // Emit over Socket.IO — same shape as real congestion updates
    const payload = updates.map((u) => ({
      segmentId: u.segmentId,
      level: u.level,
      score: u.score,
      color: u.level === 'FREE_FLOW' ? '#16a34a' :
             u.level === 'MODERATE' ? '#d97706' :
             u.level === 'HEAVY' ? '#dc2626' : '#7f1d1d',
    }));

    io.emit('traffic:congestion-update', {
      city: 'bangalore',
      phase,
      loopProgress: Math.round((elapsed % LOOP_DURATION_SECONDS) / LOOP_DURATION_SECONDS * 100),
      segmentCount: payload.length,
      updates: payload,
      timestamp: new Date().toISOString(),
      isDemo: true,
    });

    // Advance bus positions every other tick
    if (Math.floor(elapsed) % 6 < 3) {
      emitBusPositions();
    }
  } catch (err: any) {
    console.error('[DEMO] Tick error:', err.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the demo player. Idempotent — calling when already running is a no-op.
 */
export function startDemoPlayer(): void {
  if (isRunning) {
    console.log('[DEMO MODE] Already running');
    return;
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('🎬 [DEMO MODE] ACTIVE — Bangalore Traffic Congestion Demo');
  console.log('   ⚠️  Not using real sensor data');
  console.log(`   🔄 ${LOOP_DURATION_SECONDS}s day-cycle loop (${LOOP_DURATION_SECONDS / 6}s per phase)`);
  console.log('   📡 Pushing updates via traffic:congestion-update');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  isRunning = true;
  demoStartTime = Date.now();
  busPositionIndices = DEMO_BUS_ROUTES.map(() => 0);

  // Emit defects once
  setTimeout(() => emitDemoDefects(), 2000);

  // First tick immediately, then every 3 seconds
  demoTick();
  demoInterval = setInterval(demoTick, 3000);
}

/**
 * Stop the demo player and clear congestion state.
 */
export function stopDemoPlayer(): void {
  if (!isRunning) return;

  console.log('[DEMO MODE] Stopped');
  isRunning = false;

  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }

  clearCongestionState();
}

/**
 * Check if demo mode is currently active
 */
export function isDemoActive(): boolean {
  return isRunning;
}
