import { RoadEvent } from '../types';

export interface PotholeCostDetails {
  /** null when the camera could not measure it. Render as "—", never as a number. */
  diameterCm: number | null;
  widthM: number | null;
  lengthM: number | null;
  depthCm: number | null;
  areaM2: number | null;
  cost: number | null;
  /** Ready to display: a formatted amount, or "Not measured". */
  formattedCost: string;
  formattedDiameter: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Critical';
  severityColor: string;
  materialEstimate: string | null;
  recommendedWork: string;
  /** True when at least one physical dimension came from the device. */
  hasPhysicalMeasurement: boolean;
}

/**
 * Physical size of the defect, in centimetres, or null.
 *
 * Nothing is invented here. This used to fall back to a hash of the event id and GPS
 * coordinates, which produced a stable, plausible, entirely fictional diameter that was
 * indistinguishable on screen from one the camera actually derived.
 */
export function getPotholeDiameter(event: RoadEvent): number | null {
  if (event.estimatedDiameterCm && event.estimatedDiameterCm > 0) {
    return Math.round(event.estimatedDiameterCm);
  }
  if (event.widthM && event.lengthM) {
    return Math.round(((event.widthM + event.lengthM) / 2) * 100);
  }
  if (event.widthM) {
    return Math.round(event.widthM * 100);
  }
  return null;
}

/**
 * Repair sizing and costing for a defect.
 *
 * Every physical figure traces back to something the device measured or to a documented
 * class standard computed server-side. Where nothing is known, the field is null and the
 * UI shows a dash — a blank is honest, a plausible number is not.
 */
export function getPotholeCostDetails(event: RoadEvent): PotholeCostDetails {
  const diameterCm = getPotholeDiameter(event);
  const widthM = event.widthM ?? null;
  const lengthM = event.lengthM ?? null;
  const depthCm = event.depthCm ?? null;   // monocular camera cannot recover depth
  const areaM2 = event.areaM2 ?? (widthM !== null && lengthM !== null ? Number((widthM * lengthM).toFixed(2)) : null);

  const cost = event.estimatedRepairCost && event.estimatedRepairCost > 0 ? Math.round(event.estimatedRepairCost) : null;
  const hasPhysicalMeasurement = diameterCm !== null || areaM2 !== null;

  // Severity comes from the server, which scores it from defect class, measured area and
  // detector confidence. Diameter only refines the label when it is genuinely known.
  let severity: 'Minor' | 'Moderate' | 'Severe' | 'Critical';
  let severityColor: string;

  if (event.severity === 'CRITICAL' || (diameterCm !== null && diameterCm >= 75)) {
    severity = 'Critical';
    severityColor = 'text-rose-400 bg-rose-400/10 border-rose-400/30';
  } else if (event.severity === 'HIGH' || (diameterCm !== null && diameterCm >= 52)) {
    severity = 'Severe';
    severityColor = 'text-red-400 bg-red-400/10 border-red-400/30';
  } else if (event.severity === 'MEDIUM' || (diameterCm !== null && diameterCm >= 32)) {
    severity = 'Moderate';
    severityColor = 'text-orange-400 bg-orange-400/10 border-orange-400/30';
  } else {
    severity = 'Minor';
    severityColor = 'text-amber-400 bg-amber-400/10 border-amber-400/30';
  }

  // Material quantities need an area. Without one there is no quantity to state.
  let materialEstimate: string | null = null;
  let recommendedWork: string;

  if (severity === 'Critical') {
    recommendedWork = 'Structural pavement reconstruction & multi-layer heavy roller compactor';
    if (areaM2 !== null) materialEstimate = `~${Math.round(areaM2 * 35)} kg base gravel + asphalt concrete`;
  } else if (severity === 'Severe') {
    recommendedWork = 'Sub-base gravel leveling, DBM infill & vibratory roller compaction';
    if (areaM2 !== null) materialEstimate = `~${Math.round(areaM2 * 25)} kg dense bituminous macadam (DBM)`;
  } else if (severity === 'Moderate') {
    recommendedWork = 'Pothole square-cut milling, emulsion tack & plate tamping';
    if (areaM2 !== null) materialEstimate = `~${Math.round(areaM2 * 18)} kg hot/cold bituminous mix`;
  } else {
    recommendedWork = 'Manual asphalt cold-mix compaction & edge tack';
    if (areaM2 !== null) materialEstimate = `~${Math.round(areaM2 * 12)} kg cold-mix asphalt patch`;
  }

  const formattedCost =
    cost === null
      ? 'Not measured'
      : new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(cost);

  return {
    diameterCm,
    widthM,
    lengthM,
    depthCm,
    areaM2,
    cost,
    formattedCost,
    formattedDiameter: diameterCm === null ? '—' : `Ø ${diameterCm} cm`,
    severity,
    severityColor,
    materialEstimate,
    recommendedWork,
    hasPhysicalMeasurement,
  };
}
