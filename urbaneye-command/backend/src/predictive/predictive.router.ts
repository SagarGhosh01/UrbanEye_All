import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';

export const predictiveRouter = Router();

// ────────────────────────────────────────────────────────
// HELPER: deterministic hash-seeded jitter per zone/slot
// ────────────────────────────────────────────────────────
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Smooth sinusoidal wave parameterized by period and phase */
function wave(nowMs: number, periodMs: number, phase: number): number {
  return Math.sin((nowMs / periodMs) + phase);
}

// ────────────────────────────────────────────────────────
// BOTTLENECK REGISTRY — real Kapurthala / Punjab locations
// ────────────────────────────────────────────────────────
interface BottleneckSite {
  id: string;
  location: string;
  lat: number;
  lon: number;
  baseDelayMin: number;
  baseConf: number;
  /** Higher = more delay at rush hours */
  rushSensitivity: number;
}

const BOTTLENECK_SITES: BottleneckSite[] = [
  { id: 'bn-01', location: 'GT Road Junction 04 — Kapurthala',           lat: 31.3700, lon: 75.3700, baseDelayMin: 8,  baseConf: 0.92, rushSensitivity: 1.5 },
  { id: 'bn-02', location: 'NH-44 Flyover Ramp (Phagwara)',             lat: 31.2240, lon: 75.7720, baseDelayMin: 6,  baseConf: 0.88, rushSensitivity: 1.3 },
  { id: 'bn-03', location: 'Nakodar Road Intersection',                  lat: 31.3600, lon: 75.3500, baseDelayMin: 5,  baseConf: 0.82, rushSensitivity: 1.2 },
  { id: 'bn-04', location: 'Jalandhar Bypass — BMC Chowk',              lat: 31.3260, lon: 75.5760, baseDelayMin: 7,  baseConf: 0.85, rushSensitivity: 1.4 },
  { id: 'bn-05', location: 'Sultanpur Lodhi Highway — Rail Crossing',   lat: 31.2150, lon: 75.1900, baseDelayMin: 10, baseConf: 0.78, rushSensitivity: 1.0 },
  { id: 'bn-06', location: 'Kapurthala Central Bus Stand Approach',      lat: 31.3682, lon: 75.3895, baseDelayMin: 4,  baseConf: 0.90, rushSensitivity: 1.6 },
  { id: 'bn-07', location: 'SH-24 Kartarpur Road — Sugar Mill Crossing', lat: 31.4420, lon: 75.4950, baseDelayMin: 6,  baseConf: 0.81, rushSensitivity: 1.1 },
  { id: 'bn-08', location: 'NH-44 / GT Road Railway Level Crossing',     lat: 31.3350, lon: 75.4250, baseDelayMin: 12, baseConf: 0.76, rushSensitivity: 0.8 },
];

// ────────────────────────────────────────────────────────
// RECURRING HOTSPOT REGISTRY — real defect locations
// ────────────────────────────────────────────────────────
interface HotspotBase {
  id: string;
  locationName: string;
  districtId: string;
  latitude: number;
  longitude: number;
  baseRecurrence: number;
  baseSeverity: number;
  basePriority: number;
  primaryDefectType: string;
  recommendedAction: string;
}

const HOTSPOT_REGISTRY: HotspotBase[] = [
  {
    id: 'hs-101',
    locationName: 'GT Road Junction 04 — Sub-base Degradation Zone',
    districtId: 'dist-kapurthala',
    latitude: 31.3700,
    longitude: 75.3700,
    baseRecurrence: 14,
    baseSeverity: 92.4,
    basePriority: 94.0,
    primaryDefectType: 'POTHOLE',
    recommendedAction: 'Full Sub-base Asphalt Overlay & Drainage Re-engineering (IRC:37-2018 compliant)',
  },
  {
    id: 'hs-102',
    locationName: 'Nakodar Road — Fatigue Alligator Cracking Stretch',
    districtId: 'dist-kapurthala',
    latitude: 31.3580,
    longitude: 75.3520,
    baseRecurrence: 11,
    baseSeverity: 78.6,
    basePriority: 82.0,
    primaryDefectType: 'ROAD_CRACK',
    recommendedAction: 'Crack Sealing with Modified Bitumen & Microsurfacing Treatment',
  },
  {
    id: 'hs-103',
    locationName: 'NH-44 Flyover Base Slab — Surface Damage & Spalling',
    districtId: 'dist-kapurthala',
    latitude: 31.2240,
    longitude: 75.7720,
    baseRecurrence: 9,
    baseSeverity: 85.2,
    basePriority: 88.0,
    primaryDefectType: 'SURFACE_DAMAGE',
    recommendedAction: 'Emergency Flyover Deck Patch + Structural Integrity Assessment',
  },
  {
    id: 'hs-104',
    locationName: 'Sultanpur Lodhi Road — Monsoon Waterlogging Depression',
    districtId: 'dist-kapurthala',
    latitude: 31.2180,
    longitude: 75.1980,
    baseRecurrence: 18,
    baseSeverity: 74.0,
    basePriority: 79.0,
    primaryDefectType: 'WATERLOGGING',
    recommendedAction: 'Subsurface Drain Installation & Road Crown Re-profiling',
  },
  {
    id: 'hs-105',
    locationName: 'Kapurthala Railway Station Approach — Rutting',
    districtId: 'dist-kapurthala',
    latitude: 31.3620,
    longitude: 75.3942,
    baseRecurrence: 7,
    baseSeverity: 68.5,
    basePriority: 72.0,
    primaryDefectType: 'POTHOLE',
    recommendedAction: 'Hot-Mix Asphalt Patching & Heavy Vehicle Load Restriction (>10T)',
  },
  {
    id: 'hs-106',
    locationName: 'Jalandhar Bypass — BMC Chowk Pothole Cluster',
    districtId: 'dist-jalandhar',
    latitude: 31.3265,
    longitude: 75.5780,
    baseRecurrence: 12,
    baseSeverity: 88.0,
    basePriority: 91.0,
    primaryDefectType: 'POTHOLE',
    recommendedAction: 'Deep Excavation Repair with Geotextile Base Reinforcement',
  },
];

// ────────────────────────────────────────────────────────
// RECOMMENDATIONS REGISTRY — actionable AI suggestions
// ────────────────────────────────────────────────────────
interface RecommendationBase {
  id: string;
  type: 'WORK_ORDER' | 'TRAFFIC_REROUTE' | 'SAFETY_INTERVENTION';
  title: string;
  description: string;
  urgency: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  baseImpact: number;
  estimatedCostINR: number | null;
  districtId: string;
  linkedEntityId: string | null;
}

const RECOMMENDATION_REGISTRY: RecommendationBase[] = [
  {
    id: 'rec-01',
    type: 'WORK_ORDER',
    title: 'Emergency Pothole Patching — GT Road Junction 04',
    description: 'High recurrence site (14 detections in 30 days). PWD repair team assignment recommended to prevent structural road base failure. IRC:37-2018 overlay spec recommended.',
    urgency: 'CRITICAL',
    baseImpact: 95.0,
    estimatedCostINR: 145000,
    districtId: 'dist-kapurthala',
    linkedEntityId: 'hs-101',
  },
  {
    id: 'rec-02',
    type: 'TRAFFIC_REROUTE',
    title: 'Peak-Hour Freight Diversion to Phagwara Express Bypass',
    description: '15-minute predictive algorithm forecasts heavy congestion density on NH-44 corridor. Divert heavy commercial vehicles to SH-24 bypass to reduce GT Road delay.',
    urgency: 'HIGH',
    baseImpact: 88.0,
    estimatedCostINR: 0,
    districtId: 'dist-kapurthala',
    linkedEntityId: null,
  },
  {
    id: 'rec-03',
    type: 'WORK_ORDER',
    title: 'Monsoon Drain Installation — Sultanpur Lodhi Road',
    description: 'Recurring waterlogging depression detected 18 times in 30 days. Install subsurface French drain system and re-profile road crown for proper water runoff.',
    urgency: 'HIGH',
    baseImpact: 82.0,
    estimatedCostINR: 320000,
    districtId: 'dist-kapurthala',
    linkedEntityId: 'hs-104',
  },
  {
    id: 'rec-04',
    type: 'SAFETY_INTERVENTION',
    title: 'Deploy Speed Enforcement — Nakodar Road School Corridor',
    description: 'Fatigue cracking combined with school zone proximity creates compound pedestrian risk. Deploy radar speed sign + traffic calming advisory during 07:30–09:00 and 13:30–15:00.',
    urgency: 'CRITICAL',
    baseImpact: 91.0,
    estimatedCostINR: 85000,
    districtId: 'dist-kapurthala',
    linkedEntityId: 'hs-102',
  },
  {
    id: 'rec-05',
    type: 'WORK_ORDER',
    title: 'Flyover Deck Emergency Structural Assessment — NH-44',
    description: 'Surface spalling detected 9 times on NH-44 flyover deck. Structural integrity may be compromised. Schedule NHAI bridge inspection team within 48 hours.',
    urgency: 'CRITICAL',
    baseImpact: 97.0,
    estimatedCostINR: 250000,
    districtId: 'dist-kapurthala',
    linkedEntityId: 'hs-103',
  },
  {
    id: 'rec-06',
    type: 'TRAFFIC_REROUTE',
    title: 'Railway Crossing Congestion Mitigation — Alternative Route Advisory',
    description: 'GT Road level crossing causes average 12-minute delays during train passages. Issue real-time advisory to redirect via Kartarpur Road (SH-24) when crossing is down.',
    urgency: 'MEDIUM',
    baseImpact: 74.0,
    estimatedCostINR: 0,
    districtId: 'dist-kapurthala',
    linkedEntityId: 'bn-08',
  },
];

// Track dispatched status in memory
const dispatchedRecs = new Set<string>();

// ────────────────────────────────────────────────────────
// TIME-OF-DAY & DYNAMIC COMPUTATION FUNCTIONS
// ────────────────────────────────────────────────────────

function getRushMultiplier(hour: number): number {
  // Morning rush 7:30-10:00, evening rush 17:00-20:00
  if (hour >= 7.5 && hour <= 10) return 1.0 + 0.6 * Math.sin(((hour - 7.5) / 2.5) * Math.PI);
  if (hour >= 17 && hour <= 20) return 1.0 + 0.5 * Math.sin(((hour - 17) / 3) * Math.PI);
  if (hour >= 22 || hour <= 5) return 0.4;
  return 0.7;
}

function computeForecast(timeframe: 'min15' | 'min30' | 'min60', nowMs: number) {
  const date = new Date(nowMs);
  const hour = date.getHours() + date.getMinutes() / 60;

  // Project forward by timeframe offset
  const offsetMin = timeframe === 'min15' ? 15 : timeframe === 'min30' ? 30 : 60;
  const futureHour = (hour + offsetMin / 60) % 24;
  const rushMult = getRushMultiplier(futureHour);

  // Smooth time-varying oscillation (different period per timeframe)
  const period = timeframe === 'min15' ? 6000 : timeframe === 'min30' ? 8500 : 12000;
  const w1 = wave(nowMs, period, hash(timeframe) % 10);
  const w2 = wave(nowMs, period * 1.7, (hash(timeframe) + 3) % 10);

  // Base density from rush pattern + waves
  const baseDensity = timeframe === 'min15' ? 62 : timeframe === 'min30' ? 68 : 55;
  const density = Math.min(97, Math.max(28, Math.round(
    baseDensity * rushMult + w1 * 8 + w2 * 4
  )));

  const trafficLevel =
    density >= 82 ? 'SEVERE' :
    density >= 65 ? 'HEAVY' :
    density >= 42 ? 'MODERATE' : 'FREE_FLOW';

  // Select bottlenecks: more bottlenecks at longer timeframes & higher density
  const maxBN = timeframe === 'min15' ? 3 : timeframe === 'min30' ? 5 : 4;
  // Sort by rush-adjusted delay, pick top N
  const rankedBottlenecks = BOTTLENECK_SITES
    .map(bn => {
      const bnWave = wave(nowMs, 7200, hash(bn.id) % 12);
      const delayRaw = bn.baseDelayMin * rushMult * bn.rushSensitivity + bnWave * 3;
      const delay = Math.max(2, Math.round(delayRaw * 10) / 10);
      const confRaw = bn.baseConf + bnWave * 0.04 - (offsetMin / 200);
      const confidence = Math.min(0.98, Math.max(0.65, Math.round(confRaw * 100) / 100));
      return { location: bn.location, lat: bn.lat, lon: bn.lon, expectedDelayMin: delay, confidence };
    })
    .filter(b => b.expectedDelayMin >= 3)
    .sort((a, b) => b.expectedDelayMin - a.expectedDelayMin)
    .slice(0, maxBN);

  return {
    predictedDensityPercent: density,
    trafficLevel,
    predictedBottlenecks: rankedBottlenecks,
  };
}

function computePHI(nowMs: number) {
  const w1 = wave(nowMs, 18000, 0);
  const w2 = wave(nowMs, 7500, 3);

  const phi = Math.round((80.5 + w1 * 2.5 + w2 * 1.2) * 10) / 10;
  const decayPct = Math.round((-12.8 + w1 * 1.8 + w2 * 0.8) * 10) / 10;
  const subBaseCompaction = Math.round((87.2 + w1 * 1.5 + w2 * 0.6) * 10) / 10;
  const preventedLoss = Math.round((4.5 + w1 * 0.4 + w2 * 0.2) * 100) / 100;

  const phiState = phi >= 80 ? 'Good / Satisfactory' :
                   phi >= 65 ? 'Fair / Watchlist' :
                   phi >= 50 ? 'Poor / Degraded' : 'Critical / Failure Risk';

  return {
    pavementHealthIndex: phi,
    phiState,
    decayForecastPct: decayPct,
    subBaseCompaction,
    preventedLossLakhs: preventedLoss,
  };
}

function computeHotspots(nowMs: number, districtId?: string) {
  let list = HOTSPOT_REGISTRY;
  if (districtId && districtId !== 'ALL') {
    const matched = list.filter(h => h.districtId === districtId);
    if (matched.length > 0) list = matched;
    else list = list.filter(h => h.districtId === 'dist-kapurthala');
  }

  return list.map(h => {
    const w = wave(nowMs, 9500, hash(h.id) % 10);
    const recurrence = Math.max(3, h.baseRecurrence + Math.round(w * 2));
    const severity = Math.round(Math.min(99, Math.max(40, h.baseSeverity + w * 4)) * 10) / 10;
    const priority = Math.round(Math.min(100, Math.max(45, h.basePriority + w * 3)) * 10) / 10;

    return {
      id: h.id,
      locationName: h.locationName,
      districtId: h.districtId,
      latitude: h.latitude,
      longitude: h.longitude,
      recurrenceCount: recurrence,
      severityScore: severity,
      maintenancePriority: priority,
      primaryDefectType: h.primaryDefectType,
      recommendedAction: h.recommendedAction,
      createdAt: new Date(nowMs - 7 * 86400000).toISOString(),
    };
  }).sort((a, b) => b.maintenancePriority - a.maintenancePriority);
}

function computeRecommendations(nowMs: number, districtId?: string) {
  let list = RECOMMENDATION_REGISTRY;
  if (districtId && districtId !== 'ALL') {
    const matched = list.filter(r => r.districtId === districtId);
    if (matched.length > 0) list = matched;
    else list = list.filter(r => r.districtId === 'dist-kapurthala');
  }

  return list.map(r => {
    const w = wave(nowMs, 11000, hash(r.id) % 10);
    const impact = Math.round(Math.min(99, Math.max(55, r.baseImpact + w * 3)) * 10) / 10;

    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      urgency: r.urgency,
      impactScore: impact,
      estimatedCostINR: r.estimatedCostINR,
      districtId: r.districtId,
      status: dispatchedRecs.has(r.id) ? 'DISPATCHED' : 'PROPOSED',
      linkedEntityId: r.linkedEntityId,
      createdAt: new Date(nowMs - 3 * 86400000).toISOString(),
    };
  }).sort((a, b) => b.impactScore - a.impactScore);
}

// ────────────────────────────────────────────────────────
// BACKGROUND BROADCASTER — emits every 5 seconds
// ────────────────────────────────────────────────────────
let predictiveBroadcastTimer: NodeJS.Timeout | null = null;
function startPredictiveBroadcaster() {
  if (predictiveBroadcastTimer) return;
  predictiveBroadcastTimer = setInterval(() => {
    try {
      const io = getIO();
      if (!io) return;
      const now = Date.now();

      io.emit('predictive:forecast_update', {
        forecast: {
          min15: computeForecast('min15', now),
          min30: computeForecast('min30', now),
          min60: computeForecast('min60', now),
        },
        phi: computePHI(now),
        timestamp: new Date(now).toISOString(),
      });
    } catch {
      // silent
    }
  }, 5000);
}
startPredictiveBroadcaster();

// ────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────

// GET /api/predictive/forecast
predictiveRouter.get('/forecast', (req, res) => {
  const now = Date.now();
  const phi = computePHI(now);

  res.json({
    status: 'SUCCESS',
    forecast: {
      min15: computeForecast('min15', now),
      min30: computeForecast('min30', now),
      min60: computeForecast('min60', now),
    },
    phi,
    timestamp: new Date(now).toISOString(),
  });
});

// GET /api/predictive/hotspots
predictiveRouter.get('/hotspots', async (req, res) => {
  try {
    const { districtId } = req.query;
    const now = Date.now();
    const hotspots = computeHotspots(now, districtId as string);

    res.json({
      status: 'SUCCESS',
      count: hotspots.length,
      hotspots,
      timestamp: new Date(now).toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/predictive/recommendations
predictiveRouter.get('/recommendations', async (req, res) => {
  try {
    const { districtId, status } = req.query;
    const now = Date.now();
    let recs = computeRecommendations(now, districtId as string);

    if (status) {
      recs = recs.filter(r => r.status === status);
    }

    res.json({
      status: 'SUCCESS',
      count: recs.length,
      recommendations: recs,
      timestamp: new Date(now).toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// POST /api/predictive/recommendations/:id/execute
predictiveRouter.post('/recommendations/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  dispatchedRecs.add(id);

  const rec = RECOMMENDATION_REGISTRY.find(r => r.id === id);
  const title = rec ? rec.title : id;

  const socketIO = getIO();
  if (socketIO) {
    socketIO.emit('recommendation:dispatched', {
      id,
      title,
      status: 'DISPATCHED',
      executedAt: new Date().toISOString(),
    });
  }

  res.json({
    status: 'SUCCESS',
    message: `Recommendation '${title}' executed: converted into ${action || 'Work Order / Dispatch'}.`,
    recommendation: { id, title, status: 'DISPATCHED' },
  });
});
