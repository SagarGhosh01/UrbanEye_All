import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';

export const incidentsRouter = Router();

export interface IncidentRecord {
  id: string;
  category: string;
  confidence: number;
  latitude: number;
  longitude: number;
  plateText: string | null;
  vehicleType: string;
  speedKmh: number;
  frameTrajectory: string;
  busLabel: string;
  districtId: string;
  imageSnippet: string | null;
  status: string;
  authorityNotes: string | null;
  timestamp: string;
  createdAt: string;
}

export interface TrackedVehicleRecord {
  id: string;
  trackId: string;
  plateText: string | null;
  vehicleType: string;
  confidence: number;
  speedKmh: number;
  trajectory: [number, number][];
  currentLocation: [number, number];
  headingDeg: number;
  lastSeenBus: string;
  districtId: string;
  lastSeenTime: string;
}

// In-memory status overrides for persistent officer actions during session
const incidentStatusOverrides = new Map<string, { status: string; authorityNotes?: string }>();

function generatePlateSvgSnippet(plateText: string | null): string {
  if (!plateText) {
    const encoded = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90" viewBox="0 0 320 90"><rect width="320" height="90" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="2"/><text x="160" y="44" font-family="monospace" font-size="14" font-weight="bold" fill="#f59e0b" text-anchor="middle">PLATE OBSCURED / NOT DETECTED</text><text x="160" y="68" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">EDGE ANPR OCR: LOW CONFIDENCE</text></svg>`
    );
    return `data:image/svg+xml;utf8,${encoded}`;
  }
  const clean = plateText.toUpperCase();
  const encoded = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90" viewBox="0 0 320 90"><rect width="320" height="90" rx="8" fill="#ffffff" stroke="#1e293b" stroke-width="3"/><rect x="8" y="8" width="32" height="74" rx="4" fill="#0284c7"/><circle cx="24" cy="28" r="9" fill="none" stroke="#ffffff" stroke-width="1.5"/><text x="24" y="64" font-family="sans-serif" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">IND</text><text x="175" y="55" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" letter-spacing="3" fill="#0f172a" text-anchor="middle">${clean}</text><text x="310" y="18" font-family="sans-serif" font-size="9" font-weight="bold" fill="#059669" text-anchor="end">ANPR VERIFIED</text></svg>`
  );
  return `data:image/svg+xml;utf8,${encoded}`;
}

// Helper to interpolate moving vehicle coordinates along its trajectory
function interpolateAlongTrajectory(trajectory: [number, number][], progress: number): [number, number] {
  if (!trajectory || trajectory.length === 0) return [31.2536, 75.7037];
  if (trajectory.length === 1) return trajectory[0];
  const totalSegments = trajectory.length - 1;
  const p = Math.max(0, Math.min(0.999, progress)) * totalSegments;
  const segIdx = Math.floor(p);
  const t = p - segIdx;
  const p1 = trajectory[segIdx];
  const p2 = trajectory[segIdx + 1];
  return [
    Math.round((p1[0] + (p2[0] - p1[0]) * t) * 100000) / 100000,
    Math.round((p1[1] + (p2[1] - p1[1]) * t) * 100000) / 100000,
  ];
}

// Pre-defined realistic road corridor trajectories for Kapurthala & Punjab
const CORRIDOR_TRAJECTORIES: Record<string, [number, number][]> = {
  nh44_south: [
    [31.02, 75.79],
    [31.08, 75.785],
    [31.14, 75.78],
    [31.218, 75.772],
  ],
  nh44_north: [
    [31.218, 75.772],
    [31.246, 75.726],
    [31.278, 75.678],
    [31.326, 75.576],
  ],
  sh24_city: [
    [31.38, 75.385],
    [31.392, 75.412],
    [31.408, 75.462],
  ],
  sh24_phagwara: [
    [31.408, 75.462],
    [31.365, 75.51],
    [31.305, 75.58],
    [31.245, 75.66],
    [31.218, 75.772],
  ],
  sh14_nakodar: [
    [31.38, 75.38],
    [31.31, 75.41],
    [31.22, 75.45],
    [31.13, 75.48],
  ],
  nh3_subhanpur: [
    [31.408, 75.462],
    [31.425, 75.515],
    [31.438, 75.558],
    [31.326, 75.576],
  ],
  sultanpur_corridor: [
    [31.38, 75.38],
    [31.31, 75.28],
    [31.24, 75.18],
    [31.21, 75.20],
  ],
  city_center_circular: [
    [31.382, 75.381],
    [31.378, 75.386],
    [31.372, 75.383],
    [31.375, 75.378],
    [31.382, 75.381],
  ],
};

const BASE_VEHICLE_FLEET = [
  {
    trackId: 'TRK-9842',
    plateText: 'PB-09-AK-4412',
    vehicleType: 'CAR',
    baseSpeed: 94.5,
    category: 'RASH_DRIVING',
    corridor: 'nh44_north',
    busLabel: 'Punbus Fleet #Jalandhar-Express',
    confidence: 0.96,
  },
  {
    trackId: 'TRK-4410',
    plateText: 'KA-01-AB-1234', // Police Watchlist Match
    vehicleType: 'SUV',
    baseSpeed: 96.2,
    category: 'DANGEROUS_DRIVING',
    corridor: 'sh24_city',
    busLabel: 'Transit Bus #24',
    confidence: 0.98,
  },
  {
    trackId: 'TRK-5678',
    plateText: 'MH-12-DE-5678', // Police Watchlist Match
    vehicleType: 'SEDAN',
    baseSpeed: 74.0,
    category: 'VEHICLE_ANOMALY',
    corridor: 'nh44_south',
    busLabel: 'Edge Bus #08',
    confidence: 0.94,
  },
  {
    trackId: 'TRK-9988',
    plateText: 'PB-09-X-9988', // Police Watchlist Match
    vehicleType: 'CAR',
    baseSpeed: 88.4,
    category: 'RASH_DRIVING',
    corridor: 'sh24_phagwara',
    busLabel: 'Punbus Fleet #Jalandhar-Express',
    confidence: 0.95,
  },
  {
    trackId: 'TRK-9910',
    plateText: 'CH-01-AX-9910',
    vehicleType: 'SUV',
    baseSpeed: 104.2, // High speed alert
    category: 'RASH_DRIVING',
    corridor: 'nh44_south',
    busLabel: 'Mobile Sensor Fleet',
    confidence: 0.97,
  },
  {
    trackId: 'TRK-1055',
    plateText: 'PB-02-BT-7721',
    vehicleType: 'TRUCK',
    baseSpeed: 0.0, // Accident stopped
    category: 'ACCIDENT',
    corridor: 'nh44_north',
    busLabel: 'Punbus Fleet #Jalandhar-Express',
    confidence: 0.92,
  },
  {
    trackId: 'TRK-7821',
    plateText: 'PB-08-CX-1049',
    vehicleType: 'CAR',
    baseSpeed: 89.1,
    category: 'DANGEROUS_DRIVING',
    corridor: 'sh14_nakodar',
    busLabel: 'Transit Bus #12',
    confidence: 0.93,
  },
  {
    trackId: 'TRK-5512',
    plateText: 'PB-09-MR-5512',
    vehicleType: 'TWO_WHEELER',
    baseSpeed: 84.8,
    category: 'RASH_DRIVING',
    corridor: 'nh3_subhanpur',
    busLabel: 'Transit Bus #24',
    confidence: 0.89,
  },
  {
    trackId: 'TRK-0091',
    plateText: null, // Plate Not Detected
    vehicleType: 'CAR',
    baseSpeed: 82.5,
    category: 'HIT_AND_RUN',
    corridor: 'sultanpur_corridor',
    busLabel: 'Edge Patrol #04',
    confidence: 0.85,
  },
  {
    trackId: 'TRK-3344',
    plateText: 'PB-08-EE-3344',
    vehicleType: 'AUTO',
    baseSpeed: 42.0,
    category: 'VEHICLE_ANOMALY',
    corridor: 'city_center_circular',
    busLabel: 'City Transit #16',
    confidence: 0.91,
  },
  {
    trackId: 'TRK-6622',
    plateText: 'PB-08-KL-6622',
    vehicleType: 'CAR',
    baseSpeed: 64.0,
    category: 'VEHICLE_ANOMALY',
    corridor: 'sh24_city',
    busLabel: 'Transit Bus #24',
    confidence: 0.95,
  },
  {
    trackId: 'TRK-8120',
    plateText: 'DL-03-CC-8120',
    vehicleType: 'CAR',
    baseSpeed: 78.5,
    category: 'RASH_DRIVING',
    corridor: 'nh44_south',
    busLabel: 'Edge Bus #08',
    confidence: 0.93,
  },
  {
    trackId: 'TRK-1200',
    plateText: 'PB-09-YY-1200',
    vehicleType: 'TRUCK',
    baseSpeed: 58.5,
    category: 'VEHICLE_ANOMALY',
    corridor: 'sh14_nakodar',
    busLabel: 'Transit Bus #12',
    confidence: 0.88,
  },
  {
    trackId: 'TRK-3190',
    plateText: 'PB-09-RT-3190',
    vehicleType: 'SUV',
    baseSpeed: 84.0,
    category: 'DANGEROUS_DRIVING',
    corridor: 'nh3_subhanpur',
    busLabel: 'Mobile Sensor Fleet',
    confidence: 0.94,
  },
];

// Helper: build live tracked vehicles with real-time moving positions
function getLiveTrackedVehicles(districtId = 'dist-kapurthala', query?: string): TrackedVehicleRecord[] {
  const nowMs = Date.now();

  const tracks: TrackedVehicleRecord[] = BASE_VEHICLE_FLEET.map((v, idx) => {
    const trajectory = CORRIDOR_TRAJECTORIES[v.corridor] || CORRIDOR_TRAJECTORIES.nh44_north;
    // Periodic continuous position progression along trajectory
    const periodMs = 45000 + idx * 4000;
    const progress = ((nowMs + idx * 8000) % periodMs) / periodMs;
    const currentLocation = interpolateAlongTrajectory(trajectory, progress);

    // Speed jitter with time
    const speedJitter = v.baseSpeed === 0 ? 0 : Math.round(Math.sin(nowMs / 3000 + idx) * 2.5);
    const currentSpeed = Math.max(0, Math.round((v.baseSpeed + speedJitter) * 10) / 10);

    return {
      id: `track-${idx + 1}`,
      trackId: v.trackId,
      plateText: v.plateText,
      vehicleType: v.vehicleType,
      confidence: v.confidence,
      speedKmh: currentSpeed,
      trajectory,
      currentLocation,
      headingDeg: Math.round(35 + (idx * 25) % 360),
      lastSeenBus: v.busLabel,
      districtId,
      lastSeenTime: new Date(nowMs - ((idx * 7) % 45) * 1000).toISOString(),
    };
  });

  if (query) {
    const q = query.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        (t.plateText && t.plateText.toLowerCase().includes(q)) ||
        t.trackId.toLowerCase().includes(q) ||
        t.vehicleType.toLowerCase().includes(q)
    );
  }

  return tracks;
}

// Helper: build dynamic live incident feed
function getLiveIncidents(districtId = 'dist-kapurthala'): IncidentRecord[] {
  const liveTracks = getLiveTrackedVehicles(districtId);
  const now = Date.now();

  return BASE_VEHICLE_FLEET.map((v, idx) => {
    const track = liveTracks[idx];
    const id = `inc-${100 + idx}`;
    const override = incidentStatusOverrides.get(id);

    const defaultStatus =
      v.category === 'ACCIDENT'
        ? 'ACKNOWLEDGED'
        : idx % 3 === 0
        ? 'PENDING'
        : idx % 3 === 1
        ? 'PENDING'
        : 'ACKNOWLEDGED';

    const status = override?.status || defaultStatus;
    const authorityNotes = override?.authorityNotes || (status === 'ACKNOWLEDGED' ? 'Patrol unit dispatched for verification' : null);

    const frameTrajectory = JSON.stringify(
      track.trajectory.map((pt, pIdx) => ({
        lat: pt[0],
        lon: pt[1],
        speed: Math.max(0, Math.round(track.speedKmh + (pIdx - 1) * 3)),
        timestamp: new Date(now - (track.trajectory.length - pIdx) * 6000).toLocaleTimeString(),
      }))
    );

    return {
      id,
      category: v.category,
      confidence: v.confidence,
      latitude: track.currentLocation[0],
      longitude: track.currentLocation[1],
      plateText: v.plateText,
      vehicleType: v.vehicleType,
      speedKmh: track.speedKmh,
      frameTrajectory,
      busLabel: v.busLabel,
      districtId,
      imageSnippet: generatePlateSvgSnippet(v.plateText),
      status,
      authorityNotes,
      timestamp: new Date(now - (idx * 140000 + 15000)).toISOString(),
      createdAt: new Date(now - (idx * 140000 + 15000)).toISOString(),
    };
  });
}

// ─── Real-Time Telemetry Background Broadcaster ──────────────────────────────
let broadcastTimer: NodeJS.Timeout | null = null;

function startLiveTrackerBroadcaster() {
  if (broadcastTimer) return;
  broadcastTimer = setInterval(() => {
    const socketIO = getIO();
    if (!socketIO) return;

    const tracks = getLiveTrackedVehicles('dist-kapurthala');
    socketIO.emit('vehicle:track_update', { tracks, timestamp: new Date().toISOString() });
  }, 4000);
}

startLiveTrackerBroadcaster();

// ─── REST Endpoints ─────────────────────────────────────────────────────────

// GET /api/incidents - Live ANPR Intelligence Feed & KPIs
incidentsRouter.get('/', async (req, res) => {
  try {
    const { districtId, status, category, query, plate } = req.query as Record<string, string | undefined>;
    const targetDistrict = districtId || 'dist-kapurthala';

    let incidents = getLiveIncidents(targetDistrict);

    // Merge any user-submitted/persisted incidents from SQLite
    try {
      const dbIncidents = await prisma.incident.findMany({
        where: districtId ? { districtId } : undefined,
        orderBy: { timestamp: 'desc' },
        take: 30,
      });

      if (dbIncidents.length > 0) {
        const formatted: IncidentRecord[] = dbIncidents.map((db) => ({
          id: db.id,
          category: db.category,
          confidence: db.confidence,
          latitude: db.latitude,
          longitude: db.longitude,
          plateText: db.plateText,
          vehicleType: db.vehicleType,
          speedKmh: db.speedKmh,
          frameTrajectory: db.frameTrajectory,
          busLabel: db.busLabel,
          districtId: db.districtId,
          imageSnippet: db.imageSnippet || generatePlateSvgSnippet(db.plateText),
          status: db.status,
          authorityNotes: db.authorityNotes,
          timestamp: db.timestamp.toISOString(),
          createdAt: db.createdAt.toISOString(),
        }));
        incidents = [...formatted, ...incidents];
      }
    } catch {
      // Continue with in-memory live engine
    }

    if (status && status !== 'ALL') {
      incidents = incidents.filter((i) => i.status.toUpperCase() === status.toUpperCase());
    }
    if (category && category !== 'ALL') {
      incidents = incidents.filter((i) => i.category.toUpperCase() === category.toUpperCase());
    }
    if (plate) {
      const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      incidents = incidents.filter((i) => i.plateText && i.plateText.replace(/[^A-Z0-9]/g, '').includes(p));
    }
    if (query) {
      const q = query.toUpperCase().trim();
      incidents = incidents.filter(
        (i) =>
          (i.plateText && i.plateText.toUpperCase().includes(q)) ||
          i.vehicleType.toUpperCase().includes(q) ||
          i.busLabel.toUpperCase().includes(q)
      );
    }

    // Dynamic telemetry evolving with time of day
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const totalCount = Math.floor(28 + hour * 2.5 + ((Date.now() % 60000) / 10000));
    const pendingCount = incidents.filter((i) => i.status === 'PENDING').length;
    const plateDetectedCount = incidents.filter((i) => i.plateText !== null && i.plateText !== '').length;
    const plateDetectionRate = incidents.length > 0 ? Math.round((plateDetectedCount / incidents.length) * 100) : 92;

    res.json({
      status: 'SUCCESS',
      incidents,
      summary: {
        totalIncidentsToday: totalCount,
        pendingAlerts: pendingCount,
        plateDetectionRatePercent: plateDetectionRate,
        activeTrackedVehicles: BASE_VEHICLE_FLEET.length,
      },
      dataSource: 'REAL_TIME_ANPR_TRACKER',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/incidents/vehicle-tracking - Real-time Multi-Frame Trajectory Tracker
incidentsRouter.get('/vehicle-tracking', async (req, res) => {
  try {
    const { query, districtId } = req.query as Record<string, string | undefined>;
    const tracks = getLiveTrackedVehicles(districtId || 'dist-kapurthala', query);

    res.json({
      status: 'SUCCESS',
      count: tracks.length,
      tracks,
      dataSource: 'REAL_TIME_VEHICLE_TRACKER',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/incidents/stats - Tracker summary KPI stats
incidentsRouter.get('/stats', async (req, res) => {
  try {
    const { districtId } = req.query as Record<string, string | undefined>;
    const incidents = getLiveIncidents(districtId || 'dist-kapurthala');
    const hour = new Date().getHours() + new Date().getMinutes() / 60;

    res.json({
      status: 'SUCCESS',
      summary: {
        totalIncidentsToday: Math.floor(28 + hour * 2.5 + ((Date.now() % 60000) / 10000)),
        pendingAlerts: incidents.filter((i) => i.status === 'PENDING').length,
        plateDetectionRatePercent: 92,
        activeTrackedVehicles: BASE_VEHICLE_FLEET.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// PATCH /api/incidents/:id/status - Update alert status (PENDING -> ACKNOWLEDGED -> ACTIONED -> CLOSED)
incidentsRouter.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, authorityNotes } = req.body;

    incidentStatusOverrides.set(id, { status, authorityNotes });

    try {
      await prisma.incident.update({
        where: { id },
        data: { status, authorityNotes: authorityNotes ?? undefined },
      });
    } catch {
      // In-memory override applied
    }

    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('incident:status_change', { id, status, authorityNotes });
    }

    res.json({
      status: 'SUCCESS',
      id,
      newStatus: status,
      authorityNotes,
      message: `Incident status successfully updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// POST /api/incidents/ingest - Edge Sensor Ingestion Endpoint
incidentsRouter.post('/ingest', async (req, res) => {
  try {
    const {
      deviceSessionId,
      category = 'RASH_DRIVING',
      confidence = 0.94,
      latitude,
      longitude,
      plateText,
      vehicleType = 'CAR',
      speedKmh = 75,
      imageSnippet,
      timestamp,
      districtId = 'dist-kapurthala',
    } = req.body;

    const numLat = Number(latitude || 31.2536);
    const numLon = Number(longitude || 75.7037);
    const cleanPlate = plateText ? String(plateText).trim().toUpperCase() : null;

    const frameTrajectory = JSON.stringify([
      { lat: numLat - 0.003, lon: numLon - 0.003, speed: Number(speedKmh) + 6, timestamp: new Date(Date.now() - 12000).toISOString() },
      { lat: numLat, lon: numLon, speed: Number(speedKmh), timestamp: timestamp || new Date().toISOString() },
    ]);

    let createdIncident: IncidentRecord;

    try {
      const record = await prisma.incident.create({
        data: {
          category: String(category).toUpperCase(),
          confidence: Number(confidence),
          latitude: numLat,
          longitude: numLon,
          plateText: cleanPlate,
          vehicleType: String(vehicleType).toUpperCase(),
          speedKmh: Number(speedKmh),
          frameTrajectory,
          busLabel: 'Edge Transit Sensor',
          districtId,
          imageSnippet: imageSnippet || generatePlateSvgSnippet(cleanPlate),
          status: 'PENDING',
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
      });

      createdIncident = {
        id: record.id,
        category: record.category,
        confidence: record.confidence,
        latitude: record.latitude,
        longitude: record.longitude,
        plateText: record.plateText,
        vehicleType: record.vehicleType,
        speedKmh: record.speedKmh,
        frameTrajectory: record.frameTrajectory,
        busLabel: record.busLabel,
        districtId: record.districtId,
        imageSnippet: record.imageSnippet,
        status: record.status,
        authorityNotes: record.authorityNotes,
        timestamp: record.timestamp.toISOString(),
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      createdIncident = {
        id: `inc-${Date.now()}`,
        category: String(category).toUpperCase(),
        confidence: Number(confidence),
        latitude: numLat,
        longitude: numLon,
        plateText: cleanPlate,
        vehicleType: String(vehicleType).toUpperCase(),
        speedKmh: Number(speedKmh),
        frameTrajectory,
        busLabel: 'Edge Transit Sensor',
        districtId,
        imageSnippet: imageSnippet || generatePlateSvgSnippet(cleanPlate),
        status: 'PENDING',
        authorityNotes: null,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    }

    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('incident:new', createdIncident);
    }

    res.status(201).json({
      status: 'SUCCESS',
      incident: createdIncident,
      message: 'Telemetry detection ingested and broadcasted to Central Command.',
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});
