import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { emitBusPosition } from '../realtime/socket.js';

export const fleetRouter = Router();

/**
 * A bus is considered live if it has reported within this window. Past it the marker
 * is dropped rather than left sitting on a road the vehicle left hours ago — a stale
 * marker is worse than no marker, because it looks like current information.
 */
const LIVE_WINDOW_MS = 10 * 60 * 1000;

export interface BusPosition {
  sessionId: string;
  busLabel: string;
  routeTag: string | null;
  districtId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  headingDeg: number | null;
  lastSeenAt: string;
  isLive: boolean;
  eventCount: number;
}

/**
 * Records where a bus currently is.
 *
 * Called on pairing heartbeats and, more usefully, on every ingested detection —
 * those already carry a GPS fix, so a bus running any build of the app appears on
 * the map as soon as it reports anything, with no client changes required.
 */
export async function recordBusPosition(
  deviceSessionId: string,
  latitude: number,
  longitude: number,
  speedKmh?: number | null,
  headingDeg?: number | null
): Promise<void> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  try {
    const updated = await prisma.busDeviceSession.update({
      where: { id: deviceSessionId },
      data: {
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastSpeedKmh: Number.isFinite(Number(speedKmh)) ? Number(speedKmh) : null,
        lastHeadingDeg: Number.isFinite(Number(headingDeg)) ? Number(headingDeg) : null,
        lastSeenAt: new Date(),
        lastHeartbeat: new Date(),
      },
      select: {
        id: true, busLabel: true, routeTag: true, districtId: true,
        lastLatitude: true, lastLongitude: true, lastSpeedKmh: true,
        lastHeadingDeg: true, lastSeenAt: true,
      },
    });

    emitBusPosition({
      sessionId: updated.id,
      busLabel: updated.busLabel ?? 'Unnamed Bus',
      routeTag: updated.routeTag,
      districtId: updated.districtId,
      latitude: updated.lastLatitude,
      longitude: updated.lastLongitude,
      speedKmh: updated.lastSpeedKmh,
      headingDeg: updated.lastHeadingDeg,
      lastSeenAt: updated.lastSeenAt?.toISOString() ?? new Date().toISOString(),
      isLive: true,
    });
  } catch {
    // An event can arrive with a session id that was never persisted (in-memory
    // pairing fallback). That is not a reason to fail the ingest.
  }
}

/**
 * GET /api/pairing/fleet — paired buses and their last known positions.
 * Buses that have never reported a position are returned with isLive false and no
 * coordinates, so the dashboard can show them as paired-but-not-yet-reporting.
 */
fleetRouter.get('/fleet', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const where: any = { status: 'PAIRED' };
    if (req.user?.role === 'DISTRICT_HEAD' && req.user.districtId) {
      where.districtId = req.user.districtId;
    } else if (req.user?.role === 'STATE_ADMIN' && req.user.stateId) {
      where.district = { stateId: req.user.stateId };
    }

    const sessions = await prisma.busDeviceSession.findMany({
      where,
      select: {
        id: true, busLabel: true, routeTag: true, districtId: true,
        lastLatitude: true, lastLongitude: true, lastSpeedKmh: true,
        lastHeadingDeg: true, lastSeenAt: true, pairedAt: true,
        _count: { select: { events: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    const now = Date.now();
    const buses: BusPosition[] = sessions
      .filter((s) => s.lastLatitude !== null && s.lastLongitude !== null)
      .map((s) => ({
        sessionId: s.id,
        busLabel: s.busLabel ?? 'Unnamed Bus',
        routeTag: s.routeTag,
        districtId: s.districtId,
        latitude: s.lastLatitude as number,
        longitude: s.lastLongitude as number,
        speedKmh: s.lastSpeedKmh,
        headingDeg: s.lastHeadingDeg,
        lastSeenAt: (s.lastSeenAt ?? s.pairedAt ?? new Date()).toISOString(),
        isLive: s.lastSeenAt ? now - new Date(s.lastSeenAt).getTime() <= LIVE_WINDOW_MS : false,
        eventCount: s._count.events,
      }));

    res.json({
      status: 'SUCCESS',
      buses,
      pairedCount: sessions.length,
      reportingCount: buses.length,
      liveCount: buses.filter((b) => b.isLive).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

/**
 * POST /api/pairing/heartbeat — a bus reports that it is alive and where it is.
 * Accepts the loose field names the mobile clients use.
 */
fleetRouter.post('/heartbeat', async (req, res): Promise<void> => {
  try {
    const b = req.body || {};
    const sessionId = b.deviceSessionId || b.sessionId || b.id;
    const lat = Number(b.latitude ?? b.lat);
    const lon = Number(b.longitude ?? b.lon ?? b.lng);

    if (!sessionId) {
      res.status(400).json({ status: 'ERROR', message: 'deviceSessionId is required.' });
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ status: 'ERROR', message: 'latitude and longitude are required.' });
      return;
    }

    await recordBusPosition(sessionId, lat, lon, b.speedKmh ?? b.speed, b.headingDeg ?? b.heading);
    res.json({ status: 'SUCCESS', sessionId, acknowledgedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});
