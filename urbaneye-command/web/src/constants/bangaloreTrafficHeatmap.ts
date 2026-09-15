export type TrafficLevel = 'FREE_FLOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';

export interface TrafficRoadSegment {
  id: string;
  road: string;
  traffic_level: TrafficLevel;
  congestion: number; // 0 - 100%
  vehicle_count: number;
  avg_speed: number; // km/h
  last_updated: string;
  color: string;
  coordinates: [number, number][]; // Line polyline lat/lng points
}

export const BANGALORE_ROAD_SEGMENTS: TrafficRoadSegment[] = [
  {
    id: 'kr-puram-corridor',
    road: 'KR Puram Tin Factory & Cable Bridge (Old Madras Rd)',
    traffic_level: 'SEVERE',
    congestion: 96,
    vehicle_count: 1540,
    avg_speed: 9,
    last_updated: 'Just now',
    color: '#dc2626', // Red
    coordinates: [
      [13.0068, 77.6625],
      [13.0035, 77.6710],
      [13.0006, 77.6748],
      [12.9980, 77.6820],
      [12.9950, 77.6920],
    ],
  },
  {
    id: 'silk-board-junction',
    road: 'Silk Board Junction (Hosur Road / BTM)',
    traffic_level: 'SEVERE',
    congestion: 95,
    vehicle_count: 1420,
    avg_speed: 10,
    last_updated: 'Just now',
    color: '#dc2626', // Red
    coordinates: [
      [12.9245, 77.6180],
      [12.9210, 77.6205],
      [12.9172, 77.6228],
      [12.9125, 77.6255],
      [12.9080, 77.6290],
    ],
  },
  {
    id: 'orr-bellandur',
    road: 'Outer Ring Road (Silk Board → Bellandur → Devarabesanahalli)',
    traffic_level: 'SEVERE',
    congestion: 94,
    vehicle_count: 1480,
    avg_speed: 11,
    last_updated: 'Just now',
    color: '#dc2626', // Red
    coordinates: [
      [12.9172, 77.6228],
      [12.9215, 77.6410],
      [12.9260, 77.6762],
      [12.9320, 77.6840],
      [12.9410, 77.6920],
    ],
  },
  {
    id: 'marathahalli-bridge',
    road: 'Marathahalli Bridge & Varthur Main Road',
    traffic_level: 'HEAVY',
    congestion: 91,
    vehicle_count: 1280,
    avg_speed: 12,
    last_updated: 'Just now',
    color: '#ea580c', // Orange
    coordinates: [
      [12.9410, 77.6920],
      [12.9520, 77.6980],
      [12.9569, 77.7011],
      [12.9590, 77.7120],
      [12.9610, 77.7250],
    ],
  },
  {
    id: 'hebbal-flyover',
    road: 'Hebbal Flyover (NH-44 Airport Corridor / Bellary Rd)',
    traffic_level: 'SEVERE',
    congestion: 89,
    vehicle_count: 1350,
    avg_speed: 14,
    last_updated: 'Just now',
    color: '#dc2626', // Red
    coordinates: [
      [13.0180, 77.5910],
      [13.0280, 77.5940],
      [13.0358, 77.5970],
      [13.0460, 77.5995],
      [13.0580, 77.6020],
    ],
  },
  {
    id: 'whitefield-itpl',
    road: 'Whitefield ITPL Main Road',
    traffic_level: 'HEAVY',
    congestion: 84,
    vehicle_count: 1100,
    avg_speed: 18,
    last_updated: '1 min ago',
    color: '#ea580c', // Orange
    coordinates: [
      [12.9610, 77.7250],
      [12.9720, 77.7255],
      [12.9850, 77.7262],
      [12.9920, 77.7320],
      [12.9970, 77.7400],
    ],
  },
  {
    id: 'electronic-city-expressway',
    road: 'Electronic City Elevated Tollway (Hosur Rd)',
    traffic_level: 'HEAVY',
    congestion: 82,
    vehicle_count: 980,
    avg_speed: 22,
    last_updated: '2 mins ago',
    color: '#ea580c', // Orange
    coordinates: [
      [12.9080, 77.6290],
      [12.8850, 77.6420],
      [12.8620, 77.6530],
      [12.8452, 77.6602],
      [12.8310, 77.6680],
    ],
  },
  {
    id: 'koramangala-100ft',
    road: 'Koramangala 100ft Intermediate Ring Road',
    traffic_level: 'MODERATE',
    congestion: 65,
    vehicle_count: 720,
    avg_speed: 28,
    last_updated: '3 mins ago',
    color: '#eab308', // Yellow
    coordinates: [
      [12.9210, 77.6205],
      [12.9280, 77.6225],
      [12.9352, 77.6245],
      [12.9420, 77.6280],
      [12.9480, 77.6320],
    ],
  },
  {
    id: 'indiranagar-100ft',
    road: 'Indiranagar 100ft Road / CMH Corridor',
    traffic_level: 'MODERATE',
    congestion: 58,
    vehicle_count: 640,
    avg_speed: 32,
    last_updated: '4 mins ago',
    color: '#eab308', // Yellow
    coordinates: [
      [12.9620, 77.6380],
      [12.9710, 77.6395],
      [12.9784, 77.6408],
      [12.9860, 77.6425],
    ],
  },
  {
    id: 'mg-road-trinity',
    road: 'MG Road / Trinity Circle Central Highway',
    traffic_level: 'FREE_FLOW',
    congestion: 30,
    vehicle_count: 390,
    avg_speed: 48,
    last_updated: '5 mins ago',
    color: '#16a34a', // Green
    coordinates: [
      [12.9756, 77.6010],
      [12.9745, 77.6045],
      [12.9738, 77.6080],
      [12.9732, 77.6150],
      [12.9725, 77.6220],
    ],
  },
];

export const getTrafficLevelMetadata = (level: TrafficLevel) => {
  switch (level) {
    case 'SEVERE':
      return {
        color: '#dc2626',
        label: 'SEVERE',
        bgClass: 'bg-red-500/20 text-red-300 border-red-500/50',
      };
    case 'HEAVY':
      return {
        color: '#ea580c',
        label: 'HEAVY',
        bgClass: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
      };
    case 'MODERATE':
      return {
        color: '#eab308',
        label: 'MODERATE',
        bgClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      };
    case 'FREE_FLOW':
    default:
      return {
        color: '#16a34a',
        label: 'FREE FLOW',
        bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      };
  }
};
