/**
 * Bangalore Demo Congestion Scenario
 * ====================================
 * Scripted, time-based congestion patterns modeled on real Bangalore traffic behavior.
 * The full day-cycle is compressed into a ~4-minute loop (240 seconds) so that during
 * a live SIH pitch, segment colors visibly shift.
 *
 * Time mapping (240s loop):
 *   0-40s   = Early morning (5:00-8:00 AM)   — mostly free-flow, rush building
 *   40-80s  = Morning rush (8:00-10:30 AM)   — heavy/severe on key corridors
 *   80-120s = Midday (10:30 AM-2:00 PM)      — moderate everywhere
 *   120-160s = Afternoon (2:00-5:00 PM)       — moderate, building to evening rush
 *   160-200s = Evening rush (5:00-8:00 PM)    — heavy/severe peaks
 *   200-240s = Late evening (8:00-11:00 PM)   — easing to free-flow
 */

export type CongestionLevel = 'FREE_FLOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  FREE_FLOW: '#16a34a',
  MODERATE: '#d97706',
  HEAVY: '#dc2626',
  SEVERE: '#7f1d1d',
};

export interface CorridorPattern {
  /** Name/tag for matching road segments */
  namePatterns: string[];
  /** Lat/lng anchor points — segments near these will match */
  anchors: Array<{ lat: number; lon: number; radiusM: number }>;
  /** Congestion level for each phase of the day cycle (6 phases) */
  phases: CongestionLevel[];
}

/**
 * Key Bangalore corridor patterns.
 * Each defines which segments match (by name substring or proximity)
 * and their congestion level across 6 time phases.
 */
export const BANGALORE_CORRIDORS: CorridorPattern[] = [
  {
    // Silk Board Junction and ORR near it — SEVERE almost continuously
    namePatterns: ['silk board', 'hosur road', 'hosur main road'],
    anchors: [
      { lat: 12.9177, lon: 77.6238, radiusM: 800 },
      { lat: 12.9210, lon: 77.6250, radiusM: 600 },
    ],
    phases: ['HEAVY', 'SEVERE', 'SEVERE', 'SEVERE', 'SEVERE', 'HEAVY'],
  },
  {
    // Outer Ring Road (ORR) — Silk Board to KR Puram
    namePatterns: ['outer ring road', 'orr', 'ring road'],
    anchors: [
      { lat: 12.9350, lon: 77.6800, radiusM: 600 },
      { lat: 12.9563, lon: 77.7008, radiusM: 600 },
      { lat: 12.9750, lon: 77.7100, radiusM: 600 },
    ],
    phases: ['MODERATE', 'SEVERE', 'HEAVY', 'MODERATE', 'SEVERE', 'MODERATE'],
  },
  {
    // Marathahalli Bridge area
    namePatterns: ['marathahalli', 'varthur road', 'varthur main road'],
    anchors: [
      { lat: 12.9563, lon: 77.7008, radiusM: 700 },
      { lat: 12.9520, lon: 77.7020, radiusM: 500 },
    ],
    phases: ['FREE_FLOW', 'HEAVY', 'MODERATE', 'MODERATE', 'HEAVY', 'MODERATE'],
  },
  {
    // Hebbal Flyover area
    namePatterns: ['hebbal', 'bellary road', 'nh-44', 'nh 44', 'nh44'],
    anchors: [
      { lat: 13.0358, lon: 77.5970, radiusM: 800 },
      { lat: 13.0280, lon: 77.5940, radiusM: 600 },
    ],
    phases: ['FREE_FLOW', 'HEAVY', 'MODERATE', 'MODERATE', 'HEAVY', 'FREE_FLOW'],
  },
  {
    // KR Puram
    namePatterns: ['kr puram', 'k r puram', 'old madras road', 'whitefield road'],
    anchors: [
      { lat: 12.9988, lon: 77.6960, radiusM: 800 },
    ],
    phases: ['FREE_FLOW', 'HEAVY', 'MODERATE', 'MODERATE', 'SEVERE', 'MODERATE'],
  },
  {
    // MG Road / Brigade Road — Central Bangalore
    namePatterns: ['mg road', 'm g road', 'mahatma gandhi road', 'brigade road', 'residency road'],
    anchors: [
      { lat: 12.9756, lon: 77.6068, radiusM: 500 },
      { lat: 12.9716, lon: 77.6070, radiusM: 400 },
    ],
    phases: ['FREE_FLOW', 'MODERATE', 'MODERATE', 'HEAVY', 'HEAVY', 'MODERATE'],
  },
  {
    // Old Airport Road
    namePatterns: ['old airport road', 'airport road', 'old airport'],
    anchors: [
      { lat: 12.9610, lon: 77.6470, radiusM: 600 },
    ],
    phases: ['FREE_FLOW', 'HEAVY', 'MODERATE', 'MODERATE', 'HEAVY', 'FREE_FLOW'],
  },
  {
    // Koramangala / Sarjapur Road
    namePatterns: ['sarjapur road', 'koramangala', 'sarjapur'],
    anchors: [
      { lat: 12.9340, lon: 77.6260, radiusM: 600 },
    ],
    phases: ['FREE_FLOW', 'MODERATE', 'MODERATE', 'MODERATE', 'HEAVY', 'FREE_FLOW'],
  },
  {
    // Electronic City
    namePatterns: ['electronic city', 'hosur road elevated', 'nice road'],
    anchors: [
      { lat: 12.8440, lon: 77.6605, radiusM: 800 },
    ],
    phases: ['FREE_FLOW', 'HEAVY', 'MODERATE', 'MODERATE', 'HEAVY', 'FREE_FLOW'],
  },
];

/** Total loop duration in seconds */
export const LOOP_DURATION_SECONDS = 240;
/** Number of phases per loop */
export const NUM_PHASES = 6;
/** Duration of each phase in seconds */
export const PHASE_DURATION = LOOP_DURATION_SECONDS / NUM_PHASES;

/**
 * Get current phase index (0-5) based on elapsed seconds into the loop
 */
export function getCurrentPhase(elapsedSeconds: number): number {
  const position = elapsedSeconds % LOOP_DURATION_SECONDS;
  return Math.min(Math.floor(position / PHASE_DURATION), NUM_PHASES - 1);
}

/**
 * Add natural variation to congestion levels so it doesn't look perfectly uniform.
 * ~15% chance of shifting one level up or down.
 */
export function addVariation(level: CongestionLevel): CongestionLevel {
  const levels: CongestionLevel[] = ['FREE_FLOW', 'MODERATE', 'HEAVY', 'SEVERE'];
  const idx = levels.indexOf(level);
  const rand = Math.random();
  if (rand < 0.08 && idx > 0) return levels[idx - 1];
  if (rand > 0.92 && idx < levels.length - 1) return levels[idx + 1];
  return level;
}

/**
 * Demo defect markers — realistic potholes/waterlogging along key corridors
 */
export const DEMO_DEFECT_MARKERS = [
  { type: 'POTHOLE', lat: 12.9200, lon: 77.6230, confidence: 0.92, severity: 'HIGH', busLabel: 'BMTC-Fleet-07' },
  { type: 'POTHOLE', lat: 12.9555, lon: 77.6990, confidence: 0.88, severity: 'HIGH', busLabel: 'BMTC-Fleet-12' },
  { type: 'WATERLOGGING', lat: 12.9350, lon: 77.6250, confidence: 0.85, severity: 'MEDIUM', busLabel: 'BMTC-Fleet-07' },
  { type: 'SURFACE_DAMAGE', lat: 13.0310, lon: 77.5960, confidence: 0.79, severity: 'MEDIUM', busLabel: 'BMTC-Fleet-23' },
  { type: 'POTHOLE', lat: 12.9750, lon: 77.6060, confidence: 0.94, severity: 'CRITICAL', busLabel: 'BMTC-Fleet-15' },
  { type: 'WATERLOGGING', lat: 12.9600, lon: 77.6470, confidence: 0.81, severity: 'HIGH', busLabel: 'BMTC-Fleet-12' },
];

/**
 * Simulated bus positions — move along ORR during demo
 */
export const DEMO_BUS_ROUTES = [
  {
    busLabel: 'BMTC-Fleet-07',
    routeTag: 'Route 500D — ORR Circular',
    // Simplified ORR path: Silk Board → Marathahalli → KR Puram
    waypoints: [
      { lat: 12.9177, lon: 77.6238 },
      { lat: 12.9250, lon: 77.6500 },
      { lat: 12.9350, lon: 77.6800 },
      { lat: 12.9563, lon: 77.7008 },
      { lat: 12.9750, lon: 77.7100 },
      { lat: 12.9988, lon: 77.6960 },
    ],
  },
  {
    busLabel: 'BMTC-Fleet-12',
    routeTag: 'Route 365E — Hebbal–Silk Board',
    waypoints: [
      { lat: 13.0358, lon: 77.5970 },
      { lat: 13.0100, lon: 77.5960 },
      { lat: 12.9900, lon: 77.5950 },
      { lat: 12.9756, lon: 77.6068 },
      { lat: 12.9610, lon: 77.6470 },
      { lat: 12.9350, lon: 77.6250 },
      { lat: 12.9177, lon: 77.6238 },
    ],
  },
  {
    busLabel: 'BMTC-Fleet-23',
    routeTag: 'Route 401K — Electronic City Express',
    waypoints: [
      { lat: 12.9716, lon: 77.6070 },
      { lat: 12.9500, lon: 77.6200 },
      { lat: 12.9177, lon: 77.6238 },
      { lat: 12.8800, lon: 77.6450 },
      { lat: 12.8440, lon: 77.6605 },
    ],
  },
];
