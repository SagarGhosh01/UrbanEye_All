/**
 * SRIMS Detection Category Registry
 * =====================================
 * SINGLE SOURCE OF TRUTH for all detection category metadata.
 *
 * Rules:
 *  - Every component that renders a per-category color MUST import from here.
 *  - No hex color for a detection category may be hardcoded anywhere else.
 *  - Priority 1 = highest urgency (renders on top on the map, sorts first in feeds).
 *
 * Phase semantics — keep these honest, they are the answer to "what actually works":
 *  - Phase 1 = the bundled on-device model emits this class today. The model declares
 *    exactly 7 classes (D00, D10, D20, D40, D43, D44, D50); only categories backed by
 *    one of them may be phase 1.
 *  - Phase 2 = reserved config slot. No detection logic exists. Requires a retrained
 *    model or a second model, and in some cases a road-furniture reference layer.
 *  - Phase 3 = future scope, requires vehicle tracking and OCR that are not built.
 *
 * Note the deliberate split between degraded and absent infrastructure: the model can
 * see a WORN zebra crossing or lane line (phase 1), but inferring that one is MISSING
 * requires knowing it should have been there, which is a different problem (phase 2).
 */

export interface DetectionCategory {
  /** Internal code used in the DB, API, and Android detector output */
  code: string;
  /** Human-readable label shown in badges, legends, and overlays */
  displayName: string;
  /** Implementation phase: 1 = live, 2 = planned, 3 = future */
  phase: 1 | 2 | 3;
  /** Hex color used for badges, map markers (by category), and Android bounding boxes */
  hex: string;
  /**
   * Render priority: 1 = highest urgency.
   * Higher-priority markers always sit visually above lower-priority ones on the map
   * (implemented via Leaflet zIndexOffset).
   */
  priority: number;
}

/**
 * Master category table — ordered by priority ascending (highest urgency first).
 * Update this array ONLY; all consumers derive from it automatically.
 */
export const DETECTION_CATEGORIES: DetectionCategory[] = [
  // ── Phase 3: plate detection + OCR pipeline exists (OnnxPlateDetector.kt with
  //    ML Kit OCR), but the bundled plate_detector.onnx was trained on synthetic
  //    rectangles and scores ~0.01 on real vehicles. Phase 1 only after retraining
  //    on a real dataset. Vehicle tracking for hit-and-run is not built at all. ──
  {
    code: 'ANPR_INCIDENT',
    displayName: 'ANPR / Vehicle Incident',
    phase: 3,
    hex: '#dc2626',   // Alert Crimson (strictly reserved for emergency incidents)
    priority: 1,
  },
  {
    code: 'HIT_AND_RUN',
    displayName: 'Hit & Run Incident',
    phase: 3,
    hex: '#991b1b',   // Red-800
    priority: 2,
  },
  {
    code: 'RASH_DRIVING',
    displayName: 'Rash / Dangerous Driving',
    phase: 3,
    hex: '#b91c1c',   // Red-700
    priority: 3,
  },
  // ── Phase 2: needs a vehicle/person model (COCO-pretrained is sufficient) ───
  {
    code: 'TRAFFIC_BOTTLENECK',
    displayName: 'Traffic Bottleneck',
    phase: 2,
    hex: '#ea580c',   // Orange-600 (shifted from #dc2626 to reserve red for incidents)
    priority: 4,
  },
  {
    code: 'SCHOOL_CHILDREN_CROSSING',
    displayName: 'School Children Crossing',
    phase: 2,
    hex: '#10b981',   // Emerald
    priority: 4,
  },
  // ── Phase 1: emitted by the bundled 7-class model ──────────────────────────
  {
    code: 'POTHOLE',                       // D40
    displayName: 'Pothole',
    phase: 1,
    hex: '#f97316',   // Orange
    priority: 5,
  },
  {
    code: 'UTILITY_COVER',                 // D50
    displayName: 'Utility Cover / Manhole',
    phase: 1,
    hex: '#92400e',   // Ochre / Dark Brown
    priority: 6,
  },
  {
    code: 'ROAD_CRACK',                    // D00 / D10 / D20 (generic alias)
    displayName: 'Road Crack',
    phase: 1,
    hex: '#eab308',   // Amber
    priority: 7,
  },
  {
    code: 'LONGITUDINAL_CRACK',            // D00
    displayName: 'Longitudinal Crack',
    phase: 1,
    hex: '#eab308',   // Amber
    priority: 7,
  },
  {
    code: 'TRANSVERSE_CRACK',              // D10
    displayName: 'Transverse Crack',
    phase: 1,
    hex: '#eab308',   // Amber
    priority: 7,
  },
  {
    code: 'ALLIGATOR_CRACK',               // D20
    displayName: 'Alligator Crack',
    phase: 1,
    hex: '#ca8a04',   // Gold — denser cracking, distinguished from linear
    priority: 7,
  },
  {
    code: 'FADED_ZEBRA_CROSSING',          // D43 — worn crossing, NOT absence
    displayName: 'Faded Zebra Crossing',
    phase: 1,
    hex: '#059669',   // Emerald
    priority: 8,
  },
  {
    code: 'FADED_LANE_MARKING',            // D44 — worn lane line, NOT a missing divider
    displayName: 'Faded Lane Marking',
    phase: 1,
    hex: '#0d9488',   // Teal
    priority: 9,
  },
  // ── Phase 2: absence inference — needs a road-furniture reference layer ─────
  {
    code: 'MISSING_DIVIDER',
    displayName: 'Missing Road Divider',
    phase: 2,
    hex: '#0891b2',   // Cyan
    priority: 10,
  },
  {
    code: 'DIVIDER',
    displayName: 'Missing Road Divider',
    phase: 2,
    hex: '#0891b2',   // Cyan
    priority: 10,
  },
  {
    code: 'MISSING_ZEBRA_CROSSING',
    displayName: 'Missing Zebra Crossing',
    phase: 2,
    hex: '#047857',   // Emerald-700
    priority: 11,
  },
  {
    code: 'ZEBRA_CROSSING',
    displayName: 'Missing Zebra Crossing',
    phase: 2,
    hex: '#047857',   // Emerald-700
    priority: 11,
  },
  // ── Phase 2: needs a retrained model — no class in the current export ───────
  {
    code: 'DAMAGED_SIGNBOARD',
    displayName: 'Damaged/Missing Signboard',
    phase: 2,
    hex: '#a16207',   // Gold-700
    priority: 12,
  },
  {
    code: 'TRAFFIC_SIGN',
    displayName: 'Damaged/Missing Signboard',
    phase: 2,
    hex: '#a16207',   // Gold-700
    priority: 12,
  },
  {
    code: 'SURFACE_DAMAGE',
    displayName: 'Surface Wear',
    phase: 2,
    hex: '#78716c',   // Stone
    priority: 13,
  },
  {
    code: 'WATERLOGGING',
    displayName: 'Waterlogging',
    phase: 2,
    hex: '#2563eb',   // Blue
    priority: 14,
  },
  {
    code: 'VEHICLE_FLOW',
    displayName: 'Traffic Stream (density)',
    phase: 2,
    hex: '#7c3aed',   // Purple
    priority: 15,
  },
];

// ── Derived lookup helpers ────────────────────────────────────────────────────

/** Fast O(1) lookup map: category code → DetectionCategory */
const _categoryMap = new Map<string, DetectionCategory>(
  DETECTION_CATEGORIES.map((c) => [c.code, c])
);

/**
 * Returns the hex color for a given category code.
 * Falls back to slate-500 (`#64748b`) for any unknown/future code so the UI
 * never crashes when a new category arrives from the server before the config
 * is updated.
 */
export function getCategoryColor(code: string): string {
  return _categoryMap.get(code)?.hex ?? '#64748b';
}

/**
 * Returns the display name for a given category code.
 * Falls back to a humanised version of the raw code string.
 */
export function getCategoryDisplayName(code: string): string {
  return (
    _categoryMap.get(code)?.displayName ??
    code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Returns the priority number (1 = highest) for a given category code.
 * Falls back to 999 so unknown codes sort to the very bottom.
 */
export function getCategoryPriority(code: string): number {
  return _categoryMap.get(code)?.priority ?? 999;
}

/**
 * The maximum priority number in the current config.
 * Used to compute Leaflet zIndexOffset: offset = (MAX_PRIORITY - priority) * 100
 * so priority-1 markers always sit on top of priority-11 markers.
 */
export const MAX_CATEGORY_PRIORITY = Math.max(
  ...DETECTION_CATEGORIES.map((c) => c.priority)
);
