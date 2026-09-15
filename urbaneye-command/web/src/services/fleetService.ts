import { getSocket } from './socket';

const API_BASE = '/api/pairing';

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
  eventCount?: number;
}

export interface FleetSnapshot {
  buses: BusPosition[];
  pairedCount: number;
  reportingCount: number;
  liveCount: number;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('urbaneye_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Paired buses with a known position. Buses that have never reported are omitted. */
export async function getFleet(): Promise<FleetSnapshot> {
  try {
    const res = await fetch(`${API_BASE}/fleet`, { headers: authHeaders() });
    if (!res.ok) return { buses: [], pairedCount: 0, reportingCount: 0, liveCount: 0 };
    const data = await res.json();
    return {
      buses: data.buses ?? [],
      pairedCount: data.pairedCount ?? 0,
      reportingCount: data.reportingCount ?? 0,
      liveCount: data.liveCount ?? 0,
    };
  } catch {
    return { buses: [], pairedCount: 0, reportingCount: 0, liveCount: 0 };
  }
}

/**
 * Live fleet updates.
 *
 * `bus:paired` fires the moment a device completes PIN pairing, before it knows
 * where it is — those arrive with null coordinates and are ignored by the map until
 * a position follows, rather than being drawn at a guessed location.
 */
export function subscribeToFleet(
  onPosition: (bus: BusPosition) => void,
  onOffline?: (sessionId: string) => void
): () => void {
  const socket = getSocket();
  if (!socket) return () => {};

  const handlePosition = (bus: BusPosition) => {
    if (typeof bus?.latitude === 'number' && typeof bus?.longitude === 'number') {
      onPosition(bus);
    }
  };
  const handleOffline = (payload: { sessionId: string }) => {
    if (payload?.sessionId) onOffline?.(payload.sessionId);
  };

  socket.on('bus:position', handlePosition);
  socket.on('bus:paired', handlePosition);
  socket.on('bus:offline', handleOffline);

  return () => {
    socket.off('bus:position', handlePosition);
    socket.off('bus:paired', handlePosition);
    socket.off('bus:offline', handleOffline);
  };
}
