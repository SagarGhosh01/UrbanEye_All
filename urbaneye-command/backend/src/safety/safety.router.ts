import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';
import { toSegmentKey } from '../traffic/traffic.router.js';

export const safetyRouter = Router();


const DEFAULT_SAFETY_ZONES: any[] = [];

// GET /api/safety/zones
safetyRouter.get('/zones', async (req, res) => {
  try {
    const { districtId } = req.query;
    let zones = await prisma.safetyRiskZone.findMany({
      orderBy: { riskScore: 'desc' },
    });

    if (zones.length === 0) {
      zones = DEFAULT_SAFETY_ZONES as any;
    }

    if (districtId) {
      zones = zones.filter(z => z.districtId === districtId || z.districtId === 'dist-kapurthala');
    }

    res.json({
      status: 'SUCCESS',
      zones,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/safety/stats
safetyRouter.get('/stats', async (req, res) => {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const observations = await prisma.trafficObservation.findMany({
      where: { timestamp: { gte: dayAgo } },
    });

    const pedestriansSeen = observations.reduce((s, o) => s + o.pedestrians, 0);
    const segmentsWithPedestrians = new Set(
      observations.filter((o) => o.pedestrians > 0).map((o) => o.segmentKey)
    );

    // A crossing is high risk when people are present and traffic is moving fast there.
    const highRiskSegments = new Set(
      observations
        .filter((o) => o.pedestrians >= 3 && (o.busSpeedKmh ?? 0) >= 35)
        .map((o) => o.segmentKey)
    );

    const monitoredSegments = new Set(observations.map((o) => o.segmentKey));
    const overallVruSafetyScore =
      monitoredSegments.size === 0
        ? null
        : Math.max(0, 100 - Math.round((highRiskSegments.size / monitoredSegments.size) * 100));

    res.json({
      status: 'SUCCESS',
      stats: {
        overallVruSafetyScore,
        activeSchoolZonesMonitored: segmentsWithPedestrians.size,
        highRiskCrossingsCount: highRiskSegments.size,
        vulnerablePedestriansTracked: pedestriansSeen,
        segmentsObserved: monitoredSegments.size,
      },
      dataSource: 'BUS_FLEET_OBSERVATIONS',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// POST /api/safety/intervene
safetyRouter.post('/intervene', async (req, res) => {
  const { zoneId, actionType, notes } = req.body;

  const socketIO = getIO();
  if (socketIO) {
    socketIO.emit('vru:risk_alert', { zoneId, actionType, notes, dispatchedAt: new Date().toISOString() });
  }

  res.json({
    status: 'SUCCESS',
    message: `Safety intervention '${actionType}' dispatched for zone ${zoneId}`,
    dispatchedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/safety/analyze — pedestrian risk scoring for a location.
 *
 * Counts come from the bus fleet's own observations of that road segment when the caller
 * doesn't supply them. Previously this fell back to hardcoded example numbers, which made
 * the endpoint return a confident-looking risk score for places no bus had ever driven.
 * With no observations, it now says so instead of scoring.
 */
safetyRouter.post('/analyze', async (req, res) => {
  const {
    crossingOutsideMarked = true,
    isSchoolZone = true,
    latitude,
    longitude,
  } = req.body;

  let { pedestrianCount, vehicleCount, avgSpeedKmh } = req.body;

  // Pull real counts for this segment when the caller hasn't provided them.
  if (pedestrianCount === undefined || vehicleCount === undefined) {
    const where =
      Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
        ? { segmentKey: toSegmentKey(Number(latitude), Number(longitude)) }
        : {};
    const observations = await prisma.trafficObservation.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    if (observations.length === 0) {
      res.status(404).json({
        status: 'NO_DATA',
        message:
          'No bus observations for this location yet, so pedestrian risk cannot be scored. Pair a bus and drive the route first.',
      });
      return;
    }

    const passes = observations.length;
    pedestrianCount = Math.round(observations.reduce((s, o) => s + o.pedestrians, 0) / passes);
    vehicleCount = Math.round(
      observations.reduce((s, o) => s + o.cars + o.twoWheelers + o.buses + o.trucks, 0) / passes
    );
    const speeds = observations.map((o) => o.busSpeedKmh).filter((s): s is number => typeof s === 'number' && s > 0);
    avgSpeedKmh = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  }

  let riskScore = (Number(pedestrianCount) * 2.5) + (Number(vehicleCount) * 1.2) + (Number(avgSpeedKmh) * 0.85);
  if (crossingOutsideMarked) riskScore += 20;
  if (isSchoolZone) riskScore += 15;

  const finalRiskScore = Math.min(100, Math.round(riskScore));
  const riskLevel = finalRiskScore >= 80 ? 'CRITICAL' : finalRiskScore >= 65 ? 'HIGH' : finalRiskScore >= 45 ? 'MODERATE' : 'LOW';

  res.json({
    status: 'SUCCESS',
    riskEngine: 'UrbanEye Pedestrian Risk Engine (on-device person counts + segment speed)',
    assessment: {
      isSchoolZone,
      pedestriansTracked: Number(pedestrianCount),
      vehiclesNearby: Number(vehicleCount),
      averageVehicleSpeedKmh: Number(avgSpeedKmh),
      crossingOutsideMarkedCrossing: Boolean(crossingOutsideMarked),
      riskScore: finalRiskScore,
      riskLevel,
      suggestedIntervention: finalRiskScore >= 80
        ? 'CRITICAL: Dispatch Traffic Warden & Activate Flashing School Zone Warning Beacon'
        : 'HIGH: Extend Pedestrian Crossing Phase by +15 seconds & Display Dynamic Speed Warning',
      assessedAt: new Date().toISOString(),
    },
  });
});
