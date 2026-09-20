import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { TrafficRouteSegment, BottleneckAlert, TrafficIntelligenceStats, District, SegmentCongestionState, CongestionSource } from '../types';
import { getTrafficRoutes, getTrafficStats, getActiveBottlenecks } from '../services/trafficService';
import { getCongestionState, getIndiaTraffic, subscribeToCongestionUpdates } from '../services/congestionService';
import { RouteAnalysisModal } from './RouteAnalysisModal';
import { useTheme } from '../contexts/ThemeContext';
import {
  Car,
  Activity,
  AlertTriangle,
  Clock,
  Bus,
  Layers,
  MapPin,
  TrendingUp,
  SlidersHorizontal,
  ArrowRight,
  Zap,
  ShieldAlert,
  Navigation,
  Compass,
} from 'lucide-react';

interface TrafficIntelligenceViewProps {
  district?: District | null;
}

// Helper to calculate polyline center
function getPolylineCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [31.378, 75.385];
  const midIdx = Math.floor(coords.length / 2);
  return coords[midIdx];
}

export const TrafficIntelligenceView: React.FC<TrafficIntelligenceViewProps> = ({ district }) => {
  const { isDark } = useTheme();
  const [mapMode, setMapMode] = useState<'POLYLINE' | 'HEATMAP'>('POLYLINE');
  const [routes, setRoutes] = useState<TrafficRouteSegment[]>([]);
  const [congestionSource, setCongestionSource] = useState<CongestionSource>('NONE');
  const [stats, setStats] = useState<TrafficIntelligenceStats>({
    vehiclesDetectedToday: 0,
    trafficDensityPercent: 0,
    densityLevel: 'LOW',
    activeBottlenecksCount: 0,
    avgRouteDelayMinutes: 0,
    classification: { cars: 46, twoWheelers: 34, buses: 12, trucks: 8, other: 0 },
    routesCount: 0,
  });
  const [bottlenecks, setBottlenecks] = useState<BottleneckAlert[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TrafficRouteSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState<string>('');
  const [analysisModalTarget, setAnalysisModalTarget] = useState<{ routeId: string; routeName: string } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const heatLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Auto-polling telemetry every 5s so data changes with time live
  useEffect(() => {
    let isMounted = true;

    async function fetchTelemetry(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const [rData, sData, bData, indiaCongestion] = await Promise.all([
          getTrafficRoutes(district?.id),
          getTrafficStats(district?.id),
          getActiveBottlenecks(district?.id),
          getIndiaTraffic(['trunk', 'primary', 'motorway', 'expressway']),
        ]);
        if (!isMounted) return;

        let combinedRoutes: TrafficRouteSegment[] = [...rData];
        if (indiaCongestion && indiaCongestion.segments && indiaCongestion.segments.length > 0) {
          setCongestionSource(indiaCongestion.dataSource);
          const mappedFromIndia: TrafficRouteSegment[] = indiaCongestion.segments.map((seg) => {
            const levelMap: Record<string, 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE'> = {
              FREE_FLOW: 'LOW',
              MODERATE: 'MODERATE',
              HEAVY: 'HEAVY',
              SEVERE: 'SEVERE',
            };
            const level = levelMap[seg.level] || 'LOW';
            return {
              id: seg.segmentId,
              name: seg.name || `${(seg.cityTag || 'urban').toUpperCase()} Corridor`,
              startPoint: seg.name,
              endPoint: seg.cityTag || 'City Corridor',
              districtId: district?.id || 'DIST-INDIA',
              lengthKm: Math.round(((seg.coordinates?.length || 2) * 0.8) * 10) / 10,
              trafficLevel: level,
              normalSpeedKmh: 60,
              avgSpeedKmh: seg.avgSpeedKmh || 40,
              estimatedDelayMin: seg.level === 'SEVERE' ? 14 : seg.level === 'HEAVY' ? 8 : seg.level === 'MODERATE' ? 3 : 0,
              vehiclesPerMin: Math.round((seg.vehicleCountPerHour || 1200) / 60),
              bottleneckStatus: seg.level === 'SEVERE' ? 'ACTIVE' : 'NORMAL',
              junctionTag: seg.cityTag ? `${seg.cityTag.toUpperCase()} Sector` : 'Major Corridor',
              coordinates: seg.coordinates || [],
              vehicleClassification: { cars: 60, twoWheelers: 25, buses: 10, trucks: 5, other: 0 },
              detectedByBuses: ['Bus Fleet #UE-Telemetry'],
              lastUpdated: new Date().toISOString(),
            };
          });

          const existingIds = new Set(rData.map((r) => r.id));
          mappedFromIndia.forEach((r) => {
            if (!existingIds.has(r.id)) {
              combinedRoutes.push(r);
            }
          });
        }

        setRoutes(combinedRoutes);
        if (sData) setStats(sData);
        setBottlenecks(bData);
        setLastTick(new Date().toLocaleTimeString());

        setSelectedRoute((prev) => {
          if (prev) {
            const found = combinedRoutes.find((r) => r.id === prev.id);
            if (found) return found;
          }
          return combinedRoutes.length > 0 ? combinedRoutes[0] : null;
        });
      } catch (err) {
        console.error('Failed to load traffic intelligence:', err);
      } finally {
        if (isMounted && isInitial) {
          setLoading(false);
        }
      }
    }

    fetchTelemetry(true);

    const interval = setInterval(() => {
      fetchTelemetry(false);
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [district]);

  // Color Mapping Helper
  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return '#22c55e'; // Green
      case 'MODERATE':
        return '#eab308'; // Amber
      case 'HEAVY':
        return '#f97316'; // Orange
      case 'SEVERE':
        return '#ef4444'; // Red
      default:
        return '#3b82f6';
    }
  };

  // Initialize Map & Tile Layer
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] =
      district?.centerLat && district?.centerLon ? [district.centerLat, district.centerLon] : [31.2536, 75.7037];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap high-contrast tile layer (100% free, no API key required, zero watermark)
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      if (isDark) {
        const container = tileLayer.getContainer();
        if (container) {
          container.style.filter = 'brightness(0.68) invert(100%) contrast(1.25) hue-rotate(190deg) saturate(0.35)';
        }
      }

      const layerGroup = L.layerGroup().addTo(map);
      routesLayerGroupRef.current = layerGroup;
      const heatGroup = L.layerGroup().addTo(map);
      heatLayerGroupRef.current = heatGroup;
      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      mapInstanceRef.current.setView(initialCenter, 13);
      if (tileLayerRef.current) {
        const container = tileLayerRef.current.getContainer();
        if (container) {
          container.style.filter = isDark
            ? 'brightness(0.68) invert(100%) contrast(1.25) hue-rotate(190deg) saturate(0.35)'
            : 'none';
        }
      }
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [district, isDark]);

  // Window resize handler to maintain proper leaflet sizing
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render Routes as Polyline Overlays & Auto-fit bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routesLayerGroupRef.current;
    const heatGroup = heatLayerGroupRef.current;
    if (!map || !layerGroup || !heatGroup) return;

    layerGroup.clearLayers();
    heatGroup.clearLayers();

    if (routes.length === 0) return;

      const heatPoints: [number, number, number][] = [];
      const allPoints: [number, number][] = [];

      routes.forEach((route) => {
        const isSelected = selectedRoute?.id === route.id;
        const color = getTrafficColor(route.trafficLevel);

        if (route.coordinates && route.coordinates.length > 0) {
          route.coordinates.forEach((pt) => {
            if (Array.isArray(pt) && pt.length >= 2) {
              allPoints.push(pt as [number, number]);
              const intensity = route.trafficLevel === 'SEVERE' ? 1.0 : route.trafficLevel === 'HEAVY' ? 0.75 : route.trafficLevel === 'MODERATE' ? 0.45 : 0.2;
              heatPoints.push([pt[0], pt[1], intensity]);
            }
          });
        }

      // Render polylines, heatmap, and markers with ZERO hiding
      const polyline = L.polyline(route.coordinates, {
        color: color,
        weight: isSelected ? 12 : (mapMode === 'HEATMAP' ? 8 : 6),
        opacity: isSelected ? 0.98 : (mapMode === 'HEATMAP' ? 0.85 : 0.88),
        lineCap: 'round',
        lineJoin: 'round',
      });

      const polylinePopup = `
        <div style="font-family: Inter, system-ui, sans-serif; padding: 4px; min-width: 240px; color: #172B3A;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;">
            <h4 style="font-size: 13px; font-weight: 800; color: #0B3558; margin: 0; line-height: 1.2;">
              ${route.name}
            </h4>
            <span style="font-size: 9px; font-weight: 800; background: ${color}22; color: ${color}; border: 1px solid ${color}44; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${route.trafficLevel}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px;">
            <div style="background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px solid #E2E8F0;">
              <span style="color: #64748B; font-size: 9px; display: block; font-weight: 700; text-transform: uppercase;">CURRENT SPEED</span>
              <strong style="color: #0F172A; font-size: 13px;">${route.avgSpeedKmh} <span style="font-size: 10px; font-weight: 500;">km/h</span></strong>
            </div>
            <div style="background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px solid #E2E8F0;">
              <span style="color: #64748B; font-size: 9px; display: block; font-weight: 700; text-transform: uppercase;">DESIGN SPEED</span>
              <strong style="color: #0F172A; font-size: 13px;">${route.normalSpeedKmh} <span style="font-size: 10px; font-weight: 500;">km/h</span></strong>
            </div>
          </div>

          <div style="font-size: 11px; color: #334155; margin-bottom: 8px; line-height: 1.5; background: #F1F5F9; padding: 6px 8px; border-radius: 6px;">
            <div>🚦 <strong>Junction Tag:</strong> ${route.junctionTag}</div>
            <div>🏎️ <strong>Vehicle Flow:</strong> ${route.vehiclesPerMin * 60} veh/hr</div>
            <div>⏱️ <strong>Estimated Delay:</strong> +${route.estimatedDelayMin} min</div>
            <div>🚌 <strong>Monitored By:</strong> ${route.detectedByBuses?.[0] || 'Bus Fleet Telemetry'}</div>
          </div>
        </div>
      `;

      polyline.bindPopup(polylinePopup);

      polyline.on('click', () => {
        setSelectedRoute(route);
        map.flyTo(getPolylineCenter(route.coordinates), 14, { duration: 0.8 });
      });

      polyline.addTo(layerGroup);

      // Render Active Bottleneck Pulse Marker unconditionally (NO NEED HIDE)
      if (route.bottleneckStatus === 'ACTIVE') {
        const center = getPolylineCenter(route.coordinates);
        const icon = L.divIcon({
          className: 'custom-bottleneck-marker',
          html: `<div style="position: relative; display: flex; items-center: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #ef4444; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 22px; height: 22px; border-radius: 50%; background: #dc2626; border: 2px solid #ffffff; color: white; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(220,38,38,0.5);">⚠</div>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker(center, { icon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 2px;">
            <strong style="color: #dc2626;">⚠ ACTIVE BOTTLENECK</strong><br/>
            <span>${route.name} (${route.junctionTag})</span><br/>
            Speed: ${route.avgSpeedKmh} km/h (Normal: ${route.normalSpeedKmh} km/h)<br/>
            <strong>Delay: +${route.estimatedDelayMin} min</strong>
          </div>
        `);
        marker.on('click', () => {
          setSelectedRoute(route);
        });
        marker.addTo(layerGroup);
      }
    });

    // Render spatial heatmap layer unconditionally (NO NEED HIDE)
    if (heatPoints.length > 0) {
      // @ts-ignore
      L.heatLayer(heatPoints, { radius: 26, blur: 16, maxZoom: 15 }).addTo(heatGroup);
    }

      if (allPoints.length > 0 && !selectedRoute && district?.id === 'INDIA') {
        // Automatically zoom out to India if it's the India view
        map.setView([22.0, 79.0], 5);
      }

    // Invalidate size and auto-fit to routes on first arrival
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [routes, selectedRoute?.id, isDark, mapMode]);

  const handleRouteClick = (route: TrafficRouteSegment) => {
    setSelectedRoute(route);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(getPolylineCenter(route.coordinates), 14, { duration: 0.8 });
    }
  };

  return (
    <div className="space-y-6">
      {congestionSource === 'SCRIPTED_DEMO' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
          <span className="rounded bg-amber-500/25 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
            Simulated
          </span>
          <span className="text-[13px] text-amber-100/90">
            Congestion levels are a scripted Bangalore scenario. Road geometry is real OpenStreetMap data;
            the traffic values are not measured by the fleet.
          </span>
        </div>
      )}
      {/* 1. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: VEHICLES DETECTED */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
        } shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#667788]">VEHICLES DETECTED</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
              <Car className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0B3558]">{stats.vehiclesDetectedToday.toLocaleString()}</span>
            <span className="text-xs font-bold text-teal-700 bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-full">Today</span>
          </div>
          <p className="mt-1 text-[11px] text-[#667788] font-semibold">Real-time edge camera frame count</p>
        </div>

        {/* KPI 2: TRAFFIC DENSITY */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
        } shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#667788]">TRAFFIC DENSITY</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0B3558]">{stats.trafficDensityPercent}%</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase">
              {stats.densityLevel}
            </span>
          </div>
          <div className="mt-2 w-full bg-[#D8E0E8] rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full" style={{ width: `${stats.trafficDensityPercent}%` }} />
          </div>
        </div>

        {/* KPI 3: ACTIVE BOTTLENECKS */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
        } shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#667788]">ACTIVE BOTTLENECKS</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-rose-600">
              0{stats.activeBottlenecksCount}
            </span>
            <span className="text-xs font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-[#667788] font-semibold">Across monitored bus routes</p>
        </div>

        {/* KPI 4: AVG. ROUTE DELAY */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
        } shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#667788]">AVG. ROUTE DELAY</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-amber-600">
              +{stats.avgRouteDelayMinutes} min
            </span>
            <span className="text-xs font-semibold text-[#667788]">vs Normal</span>
          </div>
          <p className="mt-1 text-[11px] text-[#667788] font-semibold">Compared with baseline flow</p>
        </div>
      </div>

      {/* 2. Main Grid: Map & Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: GIS Traffic Density Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`rounded-2xl border overflow-hidden relative shadow-lg ${
            isDark ? 'bg-white border-[#D8E0E8]' : 'bg-white border-[#D8E0E8]'
          }`}>
            {/* Map Header Overlay */}
            <div className="p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-2 bg-[#F6F8FA]/90 backdrop-blur-md border-[#D8E0E8] text-[#172B3A] z-10 relative">
              <div className="flex items-center space-x-2.5">
                <Navigation className="w-4 h-4 text-[#1769AA]" />
                <span className="font-bold text-sm tracking-tight">Live GIS Traffic Density Map</span>
              </div>

              {/* Traffic Level Legend */}
              <div className="flex items-center space-x-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate
                </span>
                <span className="flex items-center gap-1 text-orange-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Heavy
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Severe
                </span>
              </div>
            </div>

            {/* Leaflet Native Canvas with guaranteed size and overlay */}
            <div className="relative w-full">
              {loading && routes.length === 0 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                  <Activity className="w-8 h-8 text-[#1769AA] animate-spin" />
                  <span className="text-xs font-semibold text-[#667788] mt-2">Connecting to Live Traffic Telemetry...</span>
                </div>
              )}
              <div
                ref={mapContainerRef}
                className="h-[480px] w-full min-h-[440px] relative z-0"
                style={{ height: '480px', minHeight: '440px' }}
              />
            </div>
          </div>

          {/* Road Telemetry Detail Inspection Drawer when clicked */}
          {selectedRoute && (
            <div className={`p-5 rounded-2xl border transition-all ${
              isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
            } shadow-sm mt-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8E0E8] pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base sm:text-lg">{selectedRoute.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      selectedRoute.trafficLevel === 'SEVERE' || selectedRoute.trafficLevel === 'HEAVY'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      Traffic Level: {selectedRoute.trafficLevel}
                    </span>
                  </div>
                  <p className="text-xs text-[#667788] mt-0.5">Segment Tag: {selectedRoute.junctionTag} • Sensor Update: {selectedRoute.lastUpdated}</p>
                </div>

                {selectedRoute.bottleneckStatus === 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Bottleneck Status: ACTIVE
                  </span>
                )}
              </div>

              {/* Grid of Road Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8]">
                  <span className="text-[11px] font-semibold text-[#667788] uppercase">Vehicles Detected</span>
                  <div className="text-xl font-extrabold font-mono text-teal-600 mt-1">{selectedRoute.vehiclesPerMin} <span className="text-xs font-normal text-[#667788]">/min</span></div>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8]">
                  <span className="text-[11px] font-semibold text-[#667788] uppercase">Average Speed</span>
                  <div className="text-xl font-extrabold font-mono text-[#0B3558] mt-1">{selectedRoute.avgSpeedKmh} <span className="text-xs font-normal text-[#667788]">km/h</span></div>
                  <div className="text-[10px] text-[#667788]">Normal: {selectedRoute.normalSpeedKmh} km/h</div>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8]">
                  <span className="text-[11px] font-semibold text-[#667788] uppercase">Estimated Delay</span>
                  <div className="text-xl font-extrabold font-mono text-amber-600 mt-1">+{selectedRoute.estimatedDelayMin} <span className="text-xs font-normal text-[#667788]">min</span></div>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8]">
                  <span className="text-[11px] font-semibold text-[#667788] uppercase">Edge Buses</span>
                  <div className="text-xs font-bold text-[#172B3A] mt-1 truncate">{selectedRoute.detectedByBuses.length} Fleet Nodes</div>
                  <div className="text-[10px] text-teal-600 truncate">{selectedRoute.detectedByBuses.join(', ')}</div>
                </div>
              </div>

              {/* Road Specific Vehicle Classification Progress Bar */}
              <div className="mt-4 pt-3 border-t border-[#D8E0E8]">
                <span className="text-xs font-bold text-[#172B3A] uppercase tracking-wider">Primary Vehicle Mix on {selectedRoute.name}:</span>
                <div className="grid grid-cols-5 gap-2 mt-2 text-center text-xs">
                  <div className="p-2 rounded bg-white border border-[#D8E0E8] shadow-sm">
                    <span className="text-[#667788] block text-[10px] font-semibold">Cars</span>
                    <span className="font-bold text-teal-600">{selectedRoute.vehicleClassification.cars}%</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#D8E0E8] shadow-sm">
                    <span className="text-[#667788] block text-[10px] font-semibold">2-Wheelers</span>
                    <span className="font-bold text-indigo-600">{selectedRoute.vehicleClassification.twoWheelers}%</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#D8E0E8] shadow-sm">
                    <span className="text-[#667788] block text-[10px] font-semibold">Buses</span>
                    <span className="font-bold text-amber-600">{selectedRoute.vehicleClassification.buses}%</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#D8E0E8] shadow-sm">
                    <span className="text-[#667788] block text-[10px] font-semibold">Trucks</span>
                    <span className="font-bold text-orange-600">{selectedRoute.vehicleClassification.trucks}%</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#D8E0E8] shadow-sm">
                    <span className="text-[#667788] block text-[10px] font-semibold">Other</span>
                    <span className="font-bold text-[#667788]">{selectedRoute.vehicleClassification.other}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Vehicle Classification & Active Bottlenecks */}
        <div className="space-y-6">
          {/* Panel A: Vehicle Classification Breakdown */}
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
          } shadow-sm`}>
            <div className="flex items-center space-x-2 border-b border-[#D8E0E8] pb-3 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-[#1769AA]" />
              <h3 className="font-bold text-sm tracking-wide uppercase">Vehicle Classification</h3>
            </div>

            <div className="space-y-3.5">
              {/* Cars */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-teal-600" /> Cars</span>
                  <span className="font-mono text-teal-600">{stats.classification.cars}%</span>
                </div>
                <div className="w-full bg-[#D8E0E8] rounded-full h-2 overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full" style={{ width: `${stats.classification.cars}%` }} />
                </div>
              </div>

              {/* Two Wheelers */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-indigo-600" /> Two-Wheelers</span>
                  <span className="font-mono text-indigo-600">{stats.classification.twoWheelers}%</span>
                </div>
                <div className="w-full bg-[#D8E0E8] rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${stats.classification.twoWheelers}%` }} />
                </div>
              </div>

              {/* Buses */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Bus className="w-3.5 h-3.5 text-amber-600" /> Buses</span>
                  <span className="font-mono text-amber-600">{stats.classification.buses}%</span>
                </div>
                <div className="w-full bg-[#D8E0E8] rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${stats.classification.buses}%` }} />
                </div>
              </div>

              {/* Trucks */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-orange-600" /> Trucks</span>
                  <span className="font-mono text-orange-600">{stats.classification.trucks}%</span>
                </div>
                <div className="w-full bg-[#D8E0E8] rounded-full h-2 overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${stats.classification.trucks}%` }} />
                </div>
              </div>

              {/* Other */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#667788]" /> Other / Commercial</span>
                  <span className="font-mono text-[#667788]">{stats.classification.other}%</span>
                </div>
                <div className="w-full bg-[#D8E0E8] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#667788] h-full rounded-full" style={{ width: `${stats.classification.other}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Panel B: Active Bottlenecks Feed */}
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-white border-[#D8E0E8] text-[#172B3A]' : 'bg-white border-[#D8E0E8] text-[#172B3A]'
          } shadow-sm`}>
            <div className="flex items-center justify-between border-b border-[#D8E0E8] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                <h3 className="font-bold text-sm tracking-wide uppercase">Active Bottleneck Feed</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                {bottlenecks.length} Active
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {bottlenecks.map((btn) => (
                <div
                  key={btn.id}
                  className="p-3.5 rounded-xl bg-white border border-[#D8E0E8] hover:border-[#1769AA] hover:shadow-md transition-all space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-[#0B3558] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        {btn.routeName}
                      </h4>
                      <p className="text-[11px] text-[#667788] mt-0.5">{btn.junctionTag}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase">
                      {btn.densityLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#D8E0E8]">
                    <div>
                      <span className="text-[#667788] block">Speed:</span>
                      <span className="font-bold font-mono text-[#172B3A]">{btn.currentSpeedKmh} km/h</span>
                    </div>
                    <div>
                      <span className="text-[#667788] block">Delay:</span>
                      <span className="font-bold font-mono text-amber-600">+{btn.delayMinutes} min</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#667788] pt-1">
                    <span className="font-semibold text-[#172B3A]">Detected by: </span>
                    <span className="text-teal-700">{btn.detectedByBuses.join(', ')}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetRoute = routes.find((r) => r.name === btn.routeName);
                        if (targetRoute) {
                          handleRouteClick(targetRoute);
                        }
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#1769AA] hover:bg-[#104a7a] text-white text-xs font-bold flex items-center justify-center space-x-1 transition active:scale-95 shadow-sm"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>View on Map</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysisModalTarget({ routeId: btn.id, routeName: btn.routeName });
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-[#F6F8FA] hover:bg-[#D8E0E8] text-[#172B3A] text-xs font-semibold flex items-center justify-center space-x-1 transition border border-[#D8E0E8] active:scale-95 shadow-sm"
                    >
                      <span>Analyze</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Route Intelligence & Diversion Modal */}
      <RouteAnalysisModal
        isOpen={!!analysisModalTarget}
        routeId={analysisModalTarget?.routeId || null}
        routeName={analysisModalTarget?.routeName || null}
        onClose={() => setAnalysisModalTarget(null)}
      />
    </div>
  );
};
