import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';

import { RoadEvent, EventStatus } from '../types';
import { MapPin, Layers, Filter, CheckSquare, Square, Eye } from 'lucide-react';
import { getIndiaTraffic } from '../services/congestionService';
import { getFleet, subscribeToFleet, BusPosition } from '../services/fleetService';

interface LiveMapProps {
  events: RoadEvent[];
  centerLat: number;
  centerLon: number;
  zoom?: number;
  onUpdateStatus?: (eventId: string, status: EventStatus, notes?: string) => void;
  onSelectEvent?: (event: RoadEvent) => void;
  latestEventId?: string | null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  events,
  centerLat,
  centerLon,
  zoom = 12,
  onUpdateStatus,
  onSelectEvent,
  latestEventId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const defectMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const busLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const heatLayerRef = useRef<any>(null);

  // Layer Toggles
  const [layers, setLayers] = useState({
    defects: true,
    buses: true,
    traffic: true,
    workOrders: false,
    roadConditions: false,
    accidentAlerts: false,
    heatmap: false,
  });

  // Filter States
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const getMarkerColor = (severity?: string | null) => {
    const sev = (severity || 'HIGH').toUpperCase();
    if (sev === 'CRITICAL') return '#C62828'; // Red
    if (sev === 'HIGH') return '#D98E04';     // Orange
    if (sev === 'MEDIUM') return '#F2A900';   // Yellow
    return '#198754';                          // Green (Low)
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: zoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      const busLayer = L.layerGroup().addTo(map);
      busLayerRef.current = busLayer;

      const trafficLayer = L.layerGroup().addTo(map);
      trafficLayerRef.current = trafficLayer;

      getIndiaTraffic(['trunk', 'primary', 'motorway', 'expressway']).then(({ segments }) => {
        segments.forEach((seg) => {
          if (seg.coordinates && seg.coordinates.length > 0) {
            const color = seg.level === 'SEVERE' ? '#ef4444' : seg.level === 'HEAVY' ? '#f97316' : seg.level === 'MODERATE' ? '#eab308' : '#22c55e';
            const poly = L.polyline(seg.coordinates, {
              color: color,
              weight: 6,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            });

            poly.bindTooltip(`
              <div style="font-family:sans-serif;font-size:11px;padding:2px;">
                <strong>${seg.name || 'Road Segment'}</strong><br/>
                Traffic Level: <span style="color:${color};font-weight:bold;">${seg.level}</span> | <strong>${seg.avgSpeedKmh || 40} km/h</strong>
              </div>
            `);

            poly.addTo(trafficLayer);
          }
        });
      });

      mapInstanceRef.current = map;
    }

    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Control traffic layer visibility
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;
    if (layers.traffic) {
      if (!mapInstanceRef.current.hasLayer(trafficLayerRef.current)) {
        mapInstanceRef.current.addLayer(trafficLayerRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(trafficLayerRef.current)) {
        mapInstanceRef.current.removeLayer(trafficLayerRef.current);
      }
    }
  }, [layers.traffic]);

  // Control buses layer visibility
  useEffect(() => {
    if (!mapInstanceRef.current || !busLayerRef.current) return;
    const busLayer = busLayerRef.current;

    if (!layers.buses) {
      busLayer.clearLayers();
      busMarkersRef.current.clear();
      return;
    }

    const busIcon = (bus: BusPosition) => {
      const colour = bus.isLive ? '#1769AA' : '#667788';
      return L.divIcon({
        className: 'srims-bus-marker',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${colour};border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.3);color:#fff;font-size:11px;font-weight:bold;">🚌</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    };

    const upsert = (bus: BusPosition) => {
      const existing = busMarkersRef.current.get(bus.sessionId);
      if (existing) {
        existing.setLatLng([bus.latitude, bus.longitude]);
        existing.setIcon(busIcon(bus));
      } else {
        const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon(bus), zIndexOffset: 1200 })
          .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:bold;">Unit UE-${bus.busLabel.slice(-3)}</div>`)
          .addTo(busLayer);
        busMarkersRef.current.set(bus.sessionId, marker);
      }
    };

    getFleet().then(({ buses }) => buses.forEach(upsert));
    const unsub = subscribeToFleet(upsert, (sessionId) => {
      const marker = busMarkersRef.current.get(sessionId);
      if (marker) {
        busLayer.removeLayer(marker);
        busMarkersRef.current.delete(sessionId);
      }
    });

    return () => unsub();
  }, [layers.buses]);

  // Update map center
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([centerLat, centerLon], zoom, { animate: true, duration: 1.0 });
    }
  }, [centerLat, centerLon, zoom]);

  // Filtered defects rendering
  const filteredEvents = events.filter((ev) => {
    if (!layers.defects) return false;
    if (selectedSeverity !== 'ALL' && (ev.severity || 'HIGH').toUpperCase() !== selectedSeverity) return false;
    if (selectedType !== 'ALL' && ev.type !== selectedType) return false;
    return true;
  });

  // Defect Markers & Heatmap
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();
    defectMarkersRef.current.clear();
    
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (layers.heatmap) {
      const heatPoints = filteredEvents.map(ev => [ev.latitude, ev.longitude, ev.severityScore ? ev.severityScore / 100 : 0.8]);
      heatLayerRef.current = (L as any).heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 15,
        gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'orange', 1.0: 'red' }
      }).addTo(mapInstanceRef.current);
      return;
    }

    filteredEvents.forEach((event) => {
      const color = getMarkerColor(event.severity);

      const iconHtml = `
        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${color}; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 10px; font-weight: 800;">
          !
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-road-marker',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
      });

      const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });

      marker.on('click', () => {
        if (onSelectEvent) onSelectEvent(event);
      });

      const popupContent = `
        <div style="font-family:Inter,sans-serif;padding:2px;min-width:180px;">
          <div style="font-weight:bold;font-size:12px;color:#0B3558;margin-bottom:4px;">
            UE-2026-${event.id.slice(-4).toUpperCase()}
          </div>
          <div style="font-size:11px;color:#172B3A;margin-bottom:2px;">
            <strong>Type:</strong> ${event.type.replace('_', ' ')}
          </div>
          <div style="font-size:11px;color:#667788;margin-bottom:2px;">
            <strong>Unit:</strong> ${event.busLabel}
          </div>
          <div style="font-size:10px;color:${color};font-weight:bold;margin-top:4px;">
            Severity: ${event.severity || 'HIGH'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(layer);
      defectMarkersRef.current.set(event.id, marker);
    });
  }, [filteredEvents, onSelectEvent, layers.heatmap, layers.defects]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#F6F8FA] rounded border border-[#D8E0E8] overflow-hidden text-[#172B3A] max-w-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Title Banner */}
      <div className="absolute top-3 left-3 z-30 bg-white/95 backdrop-blur border border-[#D8E0E8] px-3 py-1.5 rounded shadow-xs flex items-center space-x-2 text-xs max-w-[70%] sm:max-w-none">
        <MapPin className="w-4 h-4 text-[#1769AA] shrink-0" />
        <span className="font-bold text-[#0B3558] truncate">Road Infrastructure GIS Command Map</span>
      </div>

      {/* Top Right Controls: Map Layers & Filters */}
      <div className="absolute top-3 right-3 z-30 flex items-center space-x-2">
        
        {/* Layer Selector Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="px-2.5 py-1.5 rounded bg-white text-[#172B3A] border border-[#D8E0E8] shadow-xs text-xs font-bold transition flex items-center gap-1.5 hover:bg-[#F6F8FA]"
          >
            <Layers className="w-3.5 h-3.5 text-[#1769AA]" />
            <span className="hidden sm:inline">MAP LAYERS</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#D8E0E8] rounded-xl shadow-lg p-3 space-y-2 text-xs z-40">
              <div className="font-bold text-[#0B3558] border-b border-slate-100 pb-1 uppercase tracking-wider text-[10px]">
                MAP LAYERS
              </div>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.defects}
                  onChange={(e) => setLayers({ ...layers, defects: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>☑ Road Defects</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.buses}
                  onChange={(e) => setLayers({ ...layers, buses: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>☑ Active Buses</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.traffic}
                  onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>☑ Traffic Density</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-600 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.workOrders}
                  onChange={(e) => setLayers({ ...layers, workOrders: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>☐ Work Orders</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-600 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.roadConditions}
                  onChange={(e) => setLayers({ ...layers, roadConditions: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>☐ Road Conditions</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-slate-600 hover:text-black">
                <input
                  type="checkbox"
                  checked={layers.heatmap}
                  onChange={(e) => setLayers({ ...layers, heatmap: e.target.checked })}
                  className="rounded text-[#1769AA]"
                />
                <span>🔥 Heatmap Layer</span>
              </label>
            </div>
          )}
        </div>

        {/* Filter Toggle Button */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-2.5 py-1.5 rounded bg-white text-[#172B3A] border border-[#D8E0E8] shadow-xs text-xs font-bold transition flex items-center gap-1.5 hover:bg-[#F6F8FA]"
          >
            <Filter className="w-3.5 h-3.5 text-[#1769AA]" />
            <span className="hidden sm:inline">FILTERS</span>
          </button>

          {showFilters && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white border border-[#D8E0E8] rounded-xl shadow-lg p-3 space-y-3 text-xs z-40">
              <div className="font-bold text-[#0B3558] border-b border-slate-100 pb-1 uppercase tracking-wider text-[10px]">
                MAP DEFECT FILTERS
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Severity</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs rounded p-1.5 font-semibold"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">🔴 Critical</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🟢 Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Defect Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs rounded p-1.5 font-semibold"
                >
                  <option value="ALL">All Defect Types</option>
                  <option value="POTHOLE">Pothole</option>
                  <option value="ROAD_CRACK">Road Crack</option>
                  <option value="SURFACE_DAMAGE">Surface Damage</option>
                  <option value="WATERLOGGING">Waterlogging</option>
                </select>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-30 bg-white/95 backdrop-blur border border-[#D8E0E8] p-2.5 rounded shadow-xs text-xs max-w-xs space-y-1.5">
        <div className="font-bold text-[#0B3558] border-b border-[#D8E0E8] pb-1 uppercase tracking-wider text-[10px]">
          Visual Severity
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] inline-block"></span>
            <span className="font-bold text-red-700">🔴 Critical</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D98E04] inline-block"></span>
            <span className="font-bold text-orange-700">🟠 High</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2A900] inline-block"></span>
            <span className="font-bold text-amber-700">🟡 Medium</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#198754] inline-block"></span>
            <span className="font-bold text-emerald-700">🟢 Low</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LiveMap;

