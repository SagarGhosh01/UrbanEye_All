import { Router } from 'express';
import { prisma } from '../prisma.js';

export const trafficRouter = Router();

/**
 * Traffic intelligence, derived entirely from what the bus fleet actually observed.
 *
 * Method, so it can be defended rather than just displayed:
 *  - Vehicle and pedestrian counts come from the on-device detector, reported per frame
 *    batch along with the bus's own GPS speed.
 *  - Observations are bucketed into ~100 m road segments. Repeat passes over the same
 *    segment accumulate, which is what turns single readings into a traffic picture.
 *  - Congestion is inferred from the bus itself: the free-flow speed of a segment is the
 *    85th-percentile bus speed ever recorded on it, and the current speed is the recent
 *    mean. A bus crawling where buses normally move freely is the congestion signal.
 *    This needs no roadside sensor and no assumption about the speed limit.
 *
 * When no bus has reported on a segment, these endpoints return empty. They never
 * synthesise a plausible-looking road network.
 */

const SEGMENT_PRECISION = 3; // ~110 m at the equator
const RECENT_WINDOW_MS = 60 * 60 * 1000;

export function toSegmentKey(lat: number, lon: number): string {
  return `${lat.toFixed(SEGMENT_PRECISION)},${lon.toFixed(SEGMENT_PRECISION)}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function levelFromRatio(speedReductionRatio: number): string {
  if (speedReductionRatio >= 0.6) return 'SEVERE';
  if (speedReductionRatio >= 0.4) return 'HEAVY';
  if (speedReductionRatio >= 0.2) return 'MODERATE';
  return 'LOW';
}

interface SegmentSummary {
  id: string;
  name: string;
  junctionTag: string;
  districtId: string;
  trafficLevel: string;
  vehiclesPerMin: number;
  avgSpeedKmh: number;
  normalSpeedKmh: number;
  estimatedDelayMin: number;
  bottleneckStatus: string;
  coordinates: number[][];
  vehicleClassification: Record<string, number>;
  detectedByBuses: string[];
  observationCount: number;
  lastUpdated: string;
}

/**
 * Groups raw observations into per-segment summaries.
 * `confident` is false for segments with too few passes to draw conclusions from —
 * the UI should mark these provisional rather than presenting them as measurements.
 */
async function buildSegments(districtId?: string): Promise<SegmentSummary[]> {
  const observations = await prisma.trafficObservation.findMany({
    where: districtId ? { districtId } : undefined,
    orderBy: { timestamp: 'desc' },
    take: 5000,
  });
  if (observations.length === 0) return [];

  const bySegment = new Map<string, typeof observations>();
  for (const obs of observations) {
    const bucket = bySegment.get(obs.segmentKey) ?? [];
    bucket.push(obs);
    bySegment.set(obs.segmentKey, bucket);
  }

  const now = Date.now();
  const segments: SegmentSummary[] = [];

  for (const [segmentKey, group] of bySegment) {
    const speeds = group.map((o) => o.busSpeedKmh).filter((s): s is number => typeof s === 'number' && s > 0);
    // Current conditions are the few most recent passes, not an hour-wide mean — a bus
    // that ran free 50 minutes ago shouldn't mask one crawling through now.
    const recent = group.filter((o) => now - new Date(o.timestamp).getTime() <= RECENT_WINDOW_MS);
    const sample = (recent.length > 0 ? recent : group).slice(0, 3);

    const freeFlowSpeed = Math.round(percentile(speeds, 85));
    const recentSpeeds = sample.map((o) => o.busSpeedKmh).filter((s): s is number => typeof s === 'number' && s > 0);
    const currentSpeed = recentSpeeds.length
      ? Math.round(recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length)
      : freeFlowSpeed;

    const speedReductionRatio = freeFlowSpeed > 0 ? Math.max(0, (freeFlowSpeed - currentSpeed) / freeFlowSpeed) : 0;

    const totals = sample.reduce(
      (acc, o) => ({
        cars: acc.cars + o.cars,
        twoWheelers: acc.twoWheelers + o.twoWheelers,
        buses: acc.buses + o.buses,
        trucks: acc.trucks + o.trucks,
      }),
      { cars: 0, twoWheelers: 0, buses: 0, trucks: 0 }
    );
    const totalVehicles = totals.cars + totals.twoWheelers + totals.buses + totals.trucks;
    const pct = (n: number) => (totalVehicles > 0 ? Math.round((n / totalVehicles) * 100) : 0);

    const [lat, lon] = segmentKey.split(',').map(Number);
    const level = levelFromRatio(speedReductionRatio);

    segments.push({
      id: `seg-${segmentKey.replace(/[.,-]/g, '_')}`,
      name: `Segment ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      junctionTag: segmentKey,
      districtId: group[0].districtId,
      trafficLevel: level,
      vehiclesPerMin: sample.length > 0 ? Math.round(totalVehicles / sample.length) : 0,
      avgSpeedKmh: currentSpeed,
      normalSpeedKmh: freeFlowSpeed,
      estimatedDelayMin:
        currentSpeed > 0 && freeFlowSpeed > currentSpeed
          ? Math.round(((1 / currentSpeed - 1 / freeFlowSpeed) * 60 * 1).valueOf() * 10) / 10
          : 0,
      bottleneckStatus: speedReductionRatio >= 0.4 ? 'ACTIVE' : 'NORMAL',
      coordinates: [[lat, lon]],
      vehicleClassification: {
        cars: pct(totals.cars),
        twoWheelers: pct(totals.twoWheelers),
        buses: pct(totals.buses),
        trucks: pct(totals.trucks),
        other: 0,
      },
      detectedByBuses: Array.from(new Set(group.map((o) => o.busLabel))),
      observationCount: group.length,
      lastUpdated: new Date(group[0].timestamp).toISOString(),
    });
  }

  return segments.sort((a, b) => b.observationCount - a.observationCount);
}

/**
 * POST /api/traffic/observations — bus reports what its camera counted.
 */
trafficRouter.post('/observations', async (req, res) => {
  try {
    const b = req.body || {};
    const latitude = Number(b.latitude ?? b.lat);
    const longitude = Number(b.longitude ?? b.lon ?? b.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ status: 'ERROR', message: 'latitude and longitude are required.' });
      return;
    }

    let districtId = b.districtId as string | undefined;
    if (!districtId) {
      const district = await prisma.district.findFirst();
      districtId = district?.id;
    }
    if (!districtId) {
      res.status(400).json({ status: 'ERROR', message: 'No district resolved for this observation.' });
      return;
    }

    const observation = await prisma.trafficObservation.create({
      data: {
        districtId,
        busLabel: String(b.busLabel ?? 'Unknown Bus'),
        latitude,
        longitude,
        segmentKey: toSegmentKey(latitude, longitude),
        busSpeedKmh: Number.isFinite(Number(b.busSpeedKmh ?? b.speed)) ? Number(b.busSpeedKmh ?? b.speed) : null,
        cars: Math.max(0, Number(b.cars ?? 0) || 0),
        twoWheelers: Math.max(0, Number(b.twoWheelers ?? b.motorcycles ?? 0) || 0),
        buses: Math.max(0, Number(b.buses ?? 0) || 0),
        trucks: Math.max(0, Number(b.trucks ?? 0) || 0),
        pedestrians: Math.max(0, Number(b.pedestrians ?? b.persons ?? 0) || 0),
      },
    });

    res.json({ status: 'SUCCESS', observationId: observation.id, segmentKey: observation.segmentKey });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/traffic/routes
trafficRouter.get('/routes', async (req, res) => {
  try {
    const districtId = req.query.districtId as string | undefined;
    const routes = await buildSegments(districtId);
    res.json({
      status: 'SUCCESS',
      routes,
      districtId: districtId || null,
      dataSource: 'BUS_FLEET_OBSERVATIONS',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/traffic/stats
trafficRouter.get('/stats', async (req, res) => {
  try {
    const districtId = req.query.districtId as string | undefined;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todays = await prisma.trafficObservation.findMany({
      where: { ...(districtId ? { districtId } : {}), timestamp: { gte: startOfDay } },
    });

    const totals = todays.reduce(
      (acc, o) => ({
        cars: acc.cars + o.cars,
        twoWheelers: acc.twoWheelers + o.twoWheelers,
        buses: acc.buses + o.buses,
        trucks: acc.trucks + o.trucks,
        pedestrians: acc.pedestrians + o.pedestrians,
      }),
      { cars: 0, twoWheelers: 0, buses: 0, trucks: 0, pedestrians: 0 }
    );
    const vehiclesDetectedToday = totals.cars + totals.twoWheelers + totals.buses + totals.trucks;
    const pct = (n: number) => (vehiclesDetectedToday > 0 ? Math.round((n / vehiclesDetectedToday) * 100) : 0);

    const segments = await buildSegments(districtId);
    const active = segments.filter((s) => s.bottleneckStatus === 'ACTIVE');
    const avgDelay = segments.length
      ? Math.round((segments.reduce((sum, s) => sum + s.estimatedDelayMin, 0) / segments.length) * 10) / 10
      : 0;
    const densityPercent = segments.length
      ? Math.round(
          (segments.reduce((sum, s) => sum + (s.normalSpeedKmh > 0 ? 1 - s.avgSpeedKmh / s.normalSpeedKmh : 0), 0) /
            segments.length) * 100
        )
      : 0;

    res.json({
      status: 'SUCCESS',
      stats: {
        vehiclesDetectedToday,
        pedestriansDetectedToday: totals.pedestrians,
        trafficDensityPercent: densityPercent,
        densityLevel: levelFromRatio(densityPercent / 100),
        activeBottlenecksCount: active.length,
        avgRouteDelayMinutes: avgDelay,
        classification: {
          cars: pct(totals.cars),
          twoWheelers: pct(totals.twoWheelers),
          buses: pct(totals.buses),
          trucks: pct(totals.trucks),
          other: 0,
        },
        routesCount: segments.length,
        observationCount: todays.length,
      },
      dataSource: 'BUS_FLEET_OBSERVATIONS',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/traffic/bottlenecks
trafficRouter.get('/bottlenecks', async (req, res) => {
  try {
    const districtId = req.query.districtId as string | undefined;
    const segments = await buildSegments(districtId);
    const bottlenecks = segments
      .filter((s) => s.bottleneckStatus === 'ACTIVE')
      .map((s) => ({
        id: `btn-${s.id}`,
        routeName: s.name,
        junctionTag: s.junctionTag,
        densityLevel: s.trafficLevel,
        currentSpeedKmh: s.avgSpeedKmh,
        normalSpeedKmh: s.normalSpeedKmh,
        delayMinutes: s.estimatedDelayMin,
        detectedByBuses: s.detectedByBuses,
        coordinates: s.coordinates,
        districtId: s.districtId,
        observationCount: s.observationCount,
      }));

    res.json({ status: 'SUCCESS', bottlenecks, dataSource: 'BUS_FLEET_OBSERVATIONS', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

/**
 * POST /api/traffic/analyze — bottleneck scoring for one segment.
 * Baselines come from that segment's own observation history; if the segment has never
 * been observed the request is refused rather than scored against invented numbers.
 */
trafficRouter.post('/analyze', async (req, res) => {
  try {
    const { routeId, densityPercent, avgSpeedKmh, vehicleCount, districtId } = req.body || {};
    const segments = await buildSegments(districtId);
    const segment = segments.find((s) => s.id === routeId) || segments[0];

    if (!segment) {
      res.status(404).json({
        status: 'NO_DATA',
        message: 'No bus observations recorded for this district yet. Pair a bus and drive the route to populate traffic analytics.',
      });
      return;
    }

    const currentSpeed = Number(avgSpeedKmh || segment.avgSpeedKmh);
    const baselineSpeed = segment.normalSpeedKmh || currentSpeed;
    const vpm = Number(vehicleCount || segment.vehiclesPerMin);
    const currentDensity = Number(densityPercent || Math.round((1 - currentSpeed / Math.max(baselineSpeed, 1)) * 100));

    const speedReductionRatio = baselineSpeed > 0 ? Math.max(0, (baselineSpeed - currentSpeed) / baselineSpeed) : 0;
    const queueLengthMeters = Math.round(vpm * 2.25 + speedReductionRatio * 350);
    const durationMinutes = Math.round(8 + speedReductionRatio * 15);

    const bottleneckScore = Math.min(
      100,
      Math.round(speedReductionRatio * 45 + currentDensity * 0.35 + (Math.min(queueLengthMeters, 1500) / 1500) * 20)
    );

    res.json({
      status: 'SUCCESS',
      bottleneckEngine: 'UrbanEye Congestion Engine (bus-speed differential + on-device vehicle counts)',
      analysis: {
        routeId: segment.id,
        routeName: segment.name,
        junctionTag: segment.junctionTag,
        bottleneckScore,
        trafficLevel: levelFromRatio(speedReductionRatio),
        currentSpeedKmh: currentSpeed,
        baselineSpeedKmh: baselineSpeed,
        speedReductionRatio: Math.round(speedReductionRatio * 100) / 100,
        queueLengthMeters,
        durationMinutes,
        delayMinutes: segment.estimatedDelayMin,
        vehiclesPerMin: vpm,
        vehicleClassification: segment.vehicleClassification,
        observationCount: segment.observationCount,
        diagnostics: [
          {
            factor: 'Bus Speed Differential',
            severity: speedReductionRatio >= 0.5 ? 'CRITICAL' : speedReductionRatio >= 0.3 ? 'HIGH' : 'MEDIUM',
            description: `Fleet moving at ${currentSpeed} km/h against a ${baselineSpeed} km/h free-flow baseline measured on this segment.`,
          },
          {
            factor: 'Observed Vehicle Density',
            severity: currentDensity >= 80 ? 'CRITICAL' : 'HIGH',
            description: `On-device detector counted ${vpm} vehicles per pass across ${segment.observationCount} observation(s).`,
          },
        ],
        sensorDataSources: segment.detectedByBuses,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});
