import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';

import { RoadEvent, EventStatus } from '../types';
import { MapPin, Layers } from 'lucide-react';
import { resolveImageSrc } from '../utils/imageUtils';
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
  activeLayerFilters?: {
    defects?: boolean;
    traffic?: boolean;
    incidents?: boolean;
    vruSafety?: boolean;
    predictive?: boolean;
    heatmap?: boolean;
  };
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
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const heatLayerRef = useRef<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const getMarkerColor = (severity?: string | null) => {
    const sev = (severity || 'HIGH').toUpperCase();
    if (sev === 'CRITICAL') return '#C62828'; // Red
    if (sev === 'HIGH') return '#D98E04';     // Orange
    if (sev === 'MEDIUM') return '#F2A900';   // Yellow
    return '#1769AA';                          // Blue
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
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      const busLayer = L.layerGroup().addTo(map);
      busLayerRef.current = busLayer;

      const trafficLayer = L.layerGroup().addTo(map);

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
                Traffic Level: <span style="color:${color};font-weight:bold;">${seg.level}</span> | <strong>${seg.avgSpeedKmh || 40} km/h</strong><br/>
                <em>Click road for full details</em>
              </div>
            `);

            const popupContent = `
              <div style="font-family: Inter, system-ui, sans-serif; padding: 4px; min-width: 230px; color: #172B3A;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;">
                  <h4 style="font-size: 13px; font-weight: 800; color: #0B3558; margin: 0; line-height: 1.2;">
                    ${seg.name || 'Urban Road Corridor'}
                  </h4>
                  <span style="font-size: 9px; font-weight: 800; background: ${color}22; color: ${color}; border: 1px solid ${color}44; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                    ${seg.level}
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px;">
                  <div style="background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px solid #E2E8F0;">
                    <span style="color: #64748B; font-size: 9px; display: block; font-weight: 700; text-transform: uppercase;">AVG SPEED</span>
                    <strong style="color: #0F172A; font-size: 13px;">${seg.avgSpeedKmh || 40} <span style="font-size: 10px; font-weight: 500;">km/h</span></strong>
                  </div>
                  <div style="background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px solid #E2E8F0;">
                    <span style="color: #64748B; font-size: 9px; display: block; font-weight: 700; text-transform: uppercase;">VEHICLE FLOW</span>
                    <strong style="color: #0F172A; font-size: 13px;">${seg.vehicleCountPerHour || 1800} <span style="font-size: 10px; font-weight: 500;">veh/hr</span></strong>
                  </div>
                </div>

                <div style="font-size: 11px; color: #334155; margin-bottom: 8px; line-height: 1.5; background: #F1F5F9; padding: 6px 8px; border-radius: 6px;">
                  <div>🛣️ <strong>Road Class:</strong> <span style="text-transform: capitalize;">${seg.roadClass || 'Primary Corridor'}</span></div>
                  <div>📍 <strong>Location Tag:</strong> ${(seg.cityTag || 'urban').toUpperCase()}</div>
                  <div>📊 <strong>Congestion Density:</strong> ${seg.score || 45}/100</div>
                  <div>⏱️ <strong>Estimated Delay:</strong> +${seg.level === 'SEVERE' ? 14 : seg.level === 'HEAVY' ? 8 : seg.level === 'MODERATE' ? 3 : 0} mins</div>
                </div>
              </div>
            `;

            poly.bindPopup(popupContent);

            poly.on('mouseover', () => {
              poly.setStyle({ weight: 10, opacity: 1.0 });
            });

            poly.on('mouseout', () => {
              poly.setStyle({ weight: 6, opacity: 0.85 });
            });

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

  // Fleet buses layer
  useEffect(() => {
    if (!mapInstanceRef.current || !busLayerRef.current) return;
    const busLayer = busLayerRef.current;
    const markers = busMarkersRef.current;

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
      const existing = markers.get(bus.sessionId);
      if (existing) {
        existing.setLatLng([bus.latitude, bus.longitude]);
        existing.setIcon(busIcon(bus));
      } else {
        const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon(bus), zIndexOffset: 1200 })
          .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:bold;">Unit UE-${bus.busLabel.slice(-3)}</div>`)
          .addTo(busLayer);
        markers.set(bus.sessionId, marker);
      }
    };

    getFleet().then(({ buses }) => buses.forEach(upsert));
    const unsub = subscribeToFleet(upsert, (sessionId) => {
      const marker = markers.get(sessionId);
      if (marker) {
        busLayer.removeLayer(marker);
        markers.delete(sessionId);
      }
    });

    return () => unsub();
  }, []);

  // Update map center
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([centerLat, centerLon], zoom, { animate: true, duration: 1.0 });
    }
  }, [centerLat, centerLon, zoom]);

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

    if (showHeatmap) {
      const heatPoints = events.map(ev => [ev.latitude, ev.longitude, ev.severityScore ? ev.severityScore / 100 : 0.8]);
      heatLayerRef.current = (L as any).heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 15,
        gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'orange', 1.0: 'red' }
      }).addTo(mapInstanceRef.current);
      return; // Do not render individual markers when heatmap is active to prevent clutter
    }

    events.forEach((event) => {
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
  }, [events, onSelectEvent, showHeatmap]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#F6F8FA] rounded border border-[#D8E0E8] overflow-hidden text-[#172B3A]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Title Banner */}
      <div className="absolute top-3 left-3 z-30 bg-white/95 backdrop-blur border border-[#D8E0E8] px-3 py-1.5 rounded shadow-xs flex items-center space-x-2 text-xs">
        <MapPin className="w-4 h-4 text-[#1769AA]" />
        <span className="font-bold text-[#0B3558]">Road Infrastructure Intelligence Map</span>
      </div>

      {/* Heatmap Toggle */}
      <div className="absolute top-3 right-3 z-30">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`px-3 py-1.5 rounded shadow-sm text-xs font-bold transition flex items-center gap-1.5 border ${
            showHeatmap 
              ? 'bg-[#1769AA] text-white border-[#1769AA]' 
              : 'bg-white text-[#172B3A] border-[#D8E0E8] hover:bg-[#F6F8FA]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {showHeatmap ? 'Disable Heatmap' : 'Heatmap Layer'}
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-30 bg-white/95 backdrop-blur border border-[#D8E0E8] p-3 rounded shadow-xs text-xs max-w-xs space-y-1.5">
        <div className="font-bold text-[#0B3558] border-b border-[#D8E0E8] pb-1 uppercase tracking-wider text-[10px]">
          Severity Legend
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] inline-block"></span>
            <span>Critical</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D98E04] inline-block"></span>
            <span>High</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2A900] inline-block"></span>
            <span>Medium</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1769AA] inline-block"></span>
            <span>Low</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LiveMap;
