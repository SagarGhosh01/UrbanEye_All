/**
 * Congestion Service — Frontend API + Socket.IO subscription
 * ===========================================================
 * Provides REST fetches for road segments & congestion state,
 * plus a real-time Socket.IO subscription for live updates.
 */

import { SegmentCongestionState, CongestionUpdatePayload, CongestionSummary, CongestionSource } from '../types';
import { getSocket } from './socket';

const API_BASE = '/api/traffic';

/**
 * Fetch all road segments with their current congestion state
 */
export interface CongestionStateResult {
  segments: SegmentCongestionState[];
  /** Scripted scenario or real fleet data — drives the map's data-source badge. */
  dataSource: CongestionSource;
}

export async function getCongestionState(city: string = 'bangalore'): Promise<CongestionStateResult> {
  try {
    const res = await fetch(`${API_BASE}/congestion-state?city=${city}`);
    if (!res.ok) return { segments: [], dataSource: 'NONE' };
    const data = await res.json();
    let segments = data.congestion || [];
    if (segments.length === 0 && city !== 'all') {
      const fallbackRes = await fetch(`${API_BASE}/congestion-state?city=all`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        segments = fallbackData.congestion || [];
      }
    }
    return {
      segments,
      dataSource: (data.dataSource as CongestionSource) || 'NONE',
    };
  } catch {
    return { segments: [], dataSource: 'NONE' };
  }
}

export async function getCongestionSummary(): Promise<CongestionSummary | null> {
  try {
    const res = await fetch(`${API_BASE}/congestion-summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.summary || null;
  } catch (err) {
    console.error('Failed to fetch congestion summary:', err);
    return null;
  }
}

/**
 * Subscribe to real-time congestion updates via Socket.IO.
 * Returns an unsubscribe function.
 */
export function subscribeToCongestionUpdates(
  onUpdate: (payload: CongestionUpdatePayload) => void
): () => void {
  const s = getSocket();

  // Join the traffic room
  s.emit('join:traffic', 'bangalore');

  const handler = (payload: CongestionUpdatePayload) => {
    onUpdate(payload);
  };

  s.on('traffic:congestion-update', handler);

  return () => {
    s.off('traffic:congestion-update', handler);
  };
}

/**
 * Request demo mode start via Socket.IO
 */
export function startDemoMode(city: string = 'bangalore'): void {
  const s = getSocket();
  s.emit('demo:start', { city });
}

/**
 * Request demo mode stop via Socket.IO
 */
export function stopDemoMode(): void {
  const s = getSocket();
  s.emit('demo:stop');
}
