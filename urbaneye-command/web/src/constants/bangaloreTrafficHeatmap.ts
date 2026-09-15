export type TrafficLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export interface TrafficHeatmapPoint {
  id: string;
  road: string;
  lat: number;
  lng: number;
  traffic_level: TrafficLevel;
  congestion: number; // 0 - 100%
  vehicle_count: number;
  avg_speed: number; // km/h
  last_updated: string;
  radius: number;
}

export const BANGALORE_TRAFFIC_HOTSPOTS: TrafficHeatmapPoint[] = [
  {
    id: 'silk-board',
    road: 'Silk Board Junction (Hosur Road / ORR)',
    lat: 12.9172,
    lng: 77.6228,
    traffic_level: 'SEVERE',
    congestion: 95,
    vehicle_count: 1420,
    avg_speed: 10,
    last_updated: 'Just now',
    radius: 46,
  },
  {
    id: 'electronic-city',
    road: 'Electronic City Elevated Expressway',
    lat: 12.8452,
    lng: 77.6602,
    traffic_level: 'HIGH',
    congestion: 82,
    vehicle_count: 980,
    avg_speed: 22,
    last_updated: '2 mins ago',
    radius: 38,
  },
  {
    id: 'marathahalli',
    road: 'Marathahalli Bridge Junction',
    lat: 12.9569,
    lng: 77.7011,
    traffic_level: 'SEVERE',
    congestion: 91,
    vehicle_count: 1280,
    avg_speed: 12,
    last_updated: 'Just now',
    radius: 42,
  },
  {
    id: 'whitefield',
    road: 'Whitefield ITPL Main Road',
    lat: 12.9850,
    lng: 77.7262,
    traffic_level: 'HIGH',
    congestion: 84,
    vehicle_count: 1100,
    avg_speed: 18,
    last_updated: '1 min ago',
    radius: 40,
  },
  {
    id: 'hebbal',
    road: 'Hebbal Flyover (Airport Corridor)',
    lat: 13.0358,
    lng: 77.5970,
    traffic_level: 'SEVERE',
    congestion: 89,
    vehicle_count: 1350,
    avg_speed: 14,
    last_updated: 'Just now',
    radius: 44,
  },
  {
    id: 'kr-puram',
    road: 'KR Puram Tin Factory / Cable Bridge',
    lat: 13.0006,
    lng: 77.6748,
    traffic_level: 'SEVERE',
    congestion: 96,
    vehicle_count: 1540,
    avg_speed: 9,
    last_updated: 'Just now',
    radius: 48,
  },
  {
    id: 'bellandur-orr',
    road: 'Outer Ring Road (Bellandur EcoSpace)',
    lat: 12.9260,
    lng: 77.6762,
    traffic_level: 'SEVERE',
    congestion: 94,
    vehicle_count: 1480,
    avg_speed: 11,
    last_updated: 'Just now',
    radius: 46,
  },
  {
    id: 'koramangala',
    road: 'Koramangala 100ft Intermediate Ring Road',
    lat: 12.9352,
    lng: 77.6245,
    traffic_level: 'MEDIUM',
    congestion: 65,
    vehicle_count: 720,
    avg_speed: 28,
    last_updated: '3 mins ago',
    radius: 32,
  },
  {
    id: 'indiranagar',
    road: 'Indiranagar 100ft Road / CMH Junction',
    lat: 12.9784,
    lng: 77.6408,
    traffic_level: 'MEDIUM',
    congestion: 58,
    vehicle_count: 640,
    avg_speed: 32,
    last_updated: '4 mins ago',
    radius: 30,
  },
  {
    id: 'mg-road',
    road: 'MG Road / Trinity Circle',
    lat: 12.9738,
    lng: 77.6080,
    traffic_level: 'LOW',
    congestion: 35,
    vehicle_count: 390,
    avg_speed: 45,
    last_updated: '5 mins ago',
    radius: 25,
  },
];

export const getTrafficLevelMetadata = (level: TrafficLevel) => {
  switch (level) {
    case 'SEVERE':
      return {
        color: '#dc2626', // Red
        label: 'SEVERE',
        bgClass: 'bg-red-500/20 text-red-300 border-red-500/50',
      };
    case 'HIGH':
      return {
        color: '#ea580c', // Orange
        label: 'HIGH',
        bgClass: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
      };
    case 'MEDIUM':
      return {
        color: '#eab308', // Yellow
        label: 'MEDIUM',
        bgClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      };
    case 'LOW':
    default:
      return {
        color: '#22c55e', // Green
        label: 'LOW',
        bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      };
  }
};
