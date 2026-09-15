import { TrafficRouteSegment, BottleneckAlert, TrafficIntelligenceStats } from '../types';

const API_BASE = '/api/traffic';

export interface RouteAnalysisResult {
  routeId: string;
  routeName: string;
  junctionTag: string;
  trafficLevel: string;
  currentSpeedKmh: number;
  normalSpeedKmh: number;
  delayMinutes: number;
  vehiclesPerMin: number;
  diagnostics: Array<{
    factor: string;
    severity: string;
    description: string;
  }>;
  recommendedDiversions: Array<{
    id: string;
    name: string;
    via: string;
    extraDistanceKm: number;
    estimatedTimeSavedMin: number;
    trafficStatus: string;
    confidenceScore: number;
  }>;
  suggestedActions: Array<{
    id: string;
    title: string;
    icon: string;
    note: string;
  }>;
  sensorDataSources: string[];
  analyzedAt: string;
}

/**
 * No fabricated fallback data lives in this file.
 *
 * These endpoints return whatever the bus fleet actually observed. When nothing has
 * been observed yet, they return empty and the UI shows an awaiting-telemetry state.
 * A dashboard that invents plausible traffic when the backend is unreachable is worse
 * than one that shows nothing, because nobody can tell the difference.
 */

export async function getTrafficRoutes(districtId?: string): Promise<TrafficRouteSegment[]> {
  try {
    const res = await fetch(`${API_BASE}/routes?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.routes) return data.routes;
    }
  } catch (err) {
    console.warn('Traffic routes endpoint unavailable:', err);
  }
  return [];
}

export async function getTrafficStats(districtId?: string): Promise<TrafficIntelligenceStats> {
  try {
    const res = await fetch(`${API_BASE}/stats?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.stats) return data.stats;
    }
  } catch (err) {
    console.warn('Traffic stats endpoint unavailable:', err);
  }

  return {
    vehiclesDetectedToday: 0,
    trafficDensityPercent: 0,
    densityLevel: 'LOW',
    activeBottlenecksCount: 0,
    avgRouteDelayMinutes: 0,
    classification: { cars: 0, twoWheelers: 0, buses: 0, trucks: 0, other: 0 },
    routesCount: 0,
  };
}

export async function getActiveBottlenecks(districtId?: string): Promise<BottleneckAlert[]> {
  try {
    const res = await fetch(`${API_BASE}/bottlenecks?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.bottlenecks) return data.bottlenecks;
    }
  } catch (err) {
    console.warn('Bottlenecks endpoint unavailable:', err);
  }
  return [];
}

export async function analyzeRoute(routeId: string, routeName?: string): Promise<RouteAnalysisResult | null> {
  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId, routeName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.analysis) return data.analysis;
    }
  } catch (err) {
    console.warn('Route analysis endpoint unavailable:', err);
  }
  // Null means "no bus has observed this segment yet", which the modal renders as an
  // awaiting-telemetry state. Never substitute an invented analysis here.
  return null;
}
