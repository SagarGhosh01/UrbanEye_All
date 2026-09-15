import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RoadEvent, EventStatus, SegmentCongestionState, CongestionLevel, CongestionSource } from '../types';
import { ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { getCategoryPriority, MAX_CATEGORY_PRIORITY } from '../constants/detectionCategories';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { resolveImageSrc } from '../utils/imageUtils';
import { useTheme } from '../contexts/ThemeContext';
import { getCongestionState, subscribeToCongestionUpdates } from '../services/congestionService';

import { BANGALORE_TRAFFIC_HOTSPOTS, getTrafficLevelMetadata } from '../constants/bangaloreTrafficHeatmap';

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
    trafficHeatmap?: boolean;
    incidents?: boolean;
    vruSafety?: boolean;
    predictive?: boolean;
    heatmap?: boolean;
  };
}

const STATUS_METADATA: Record<EventStatus, { bg: string; text: string; label: string; symbol: string }> = {
  NEW: { bg: '#dc2626', text: '#ffffff', label: 'New Defect', symbol: '!' },
  ASSIGNED_FOR_REPAIR: { bg: '#d97706', text: '#ffffff', label: 'Assigned Repair', symbol: '⚙' },
  RESOLVED: { bg: '#1E7F73', text: '#ffffff', label: 'Resolved', symbol: '✓' },
  REVIEWED: { bg: '#475569', text: '#ffffff', label: 'Reviewed', symbol: '•' },
};

export const LiveMap: React.FC<LiveMapProps> = ({
  events,
  centerLat,
  centerLon,
  zoom = 12,
  onUpdateStatus,
  onSelectEvent,
  latestEventId,
  activeLayerFilters = { defects: true, traffic: true, trafficHeatmap: true, incidents: true, vruSafety: true, predictive: true, heatmap: true },
}) => {
  const { isDark } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const vruLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficHeatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficPolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const pulseCircleRef = useRef<L.CircleMarker | null>(null);

  // Layer toggle state
  const [layers, setLayers] = useState({
    defects: activeLayerFilters.defects ?? true,
    traffic: activeLayerFilters.traffic ?? true,
    trafficHeatmap: activeLayerFilters.trafficHeatmap ?? true,
    incidents: activeLayerFilters.incidents ?? true,
    vruSafety: activeLayerFilters.vruSafety ?? true,
    predictive: activeLayerFilters.predictive ?? true,
    heatmap: activeLayerFilters.heatmap ?? true,
  });

  // Collapsible legend state
  const [legendOpen, setLegendOpen] = useState(false);
  // Provenance of the congestion overlay. Surfaced on the map, because an overlay
  // animating over real OSM geometry is indistinguishable from measured traffic.
  const [congestionSource, setCongestionSource] = useState<CongestionSource>('NONE');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: zoom,
        zoomControl: false, // Repositioned zoom control
      });

      // Bottom-right zoom control: thumb-safe for one-handed mobile use & prevents blocking header
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap high-contrast tile layer (100% free, no API key required, zero watermark)
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (isDark) {
        const container = tileLayer.getContainer();
        if (container) {
          container.style.filter = 'brightness(0.68) invert(100%) contrast(1.25) hue-rotate(190deg) saturate(0.35)';
        }
      }

      // Heatmap spatial density layer — renders below markers
      const heatmapLayer = L.layerGroup().addTo(map);
      heatmapLayerRef.current = heatmapLayer;

      // Google Maps Traffic Density Heatmap Layer
      const trafficHeatmapLayer = L.layerGroup().addTo(map);
      trafficHeatmapLayerRef.current = trafficHeatmapLayer;

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Traffic congestion polyline layer — renders below markers
      const trafficLayer = L.layerGroup().addTo(map);
      trafficLayerRef.current = trafficLayer;

      mapInstanceRef.current = map;
    }

    // ResizeObserver & window resize listener for immediate orientation/dimension adaptation
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    let ro: ResizeObserver | null = null;
    if (mapContainerRef.current && window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (ro) ro.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── Traffic Congestion Layer ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;

    const trafficLayer = trafficLayerRef.current;
    const polylines = trafficPolylinesRef.current;

    // Initial fetch of congestion state
    getCongestionState('bangalore').then(({ segments, dataSource }) => {
      setCongestionSource(dataSource);
      if (segments.length === 0) return;
      segments.forEach((seg) => {
        if (!seg.coordinates || seg.coordinates.length < 2) return;
        const latLngs = seg.coordinates.map(([lat, lng]: [number, number]) => L.latLng(lat, lng));
        const weight = seg.roadClass === 'trunk' || seg.roadClass === 'primary' ? 5 : seg.roadClass === 'secondary' ? 4 : 3;
        const polyline = L.polyline(latLngs, {
          color: seg.color || '#16a34a',
          weight,
          opacity: 0.82,
          lineJoin: 'round',
          lineCap: 'round',
        });
        if (seg.name) {
          const levelLabel = seg.level.replace('_', ' ');
          polyline.bindTooltip(
            `<strong>${seg.name}</strong><br/><span style="color:${seg.color};font-weight:700">${levelLabel}</span> · Score: ${seg.score}`,
            { sticky: true, className: 'traffic-tooltip' }
          );
        }
        polyline.addTo(trafficLayer);
        polylines.set(seg.segmentId, polyline);
      });
    });

    // Subscribe to real-time congestion updates via Socket.IO
    const unsub = subscribeToCongestionUpdates((payload) => {
      if (!payload.updates) return;
      payload.updates.forEach((update) => {
        const existing = polylines.get(update.segmentId);
        if (existing) {
          existing.setStyle({ color: update.color });
          // Update tooltip content if bound
          const tooltip = existing.getTooltip();
          if (tooltip) {
            const levelLabel = update.level.replace('_', ' ');
            existing.setTooltipContent(
              `<strong>${(tooltip.getContent() as string)?.match(/<strong>(.*?)<\/strong>/)?.[1] || 'Road Segment'}</strong><br/><span style="color:${update.color};font-weight:700">${levelLabel}</span> · Score: ${update.score}`
            );
          }
        }
      });
    });

    return () => {
      unsub();
      trafficLayer.clearLayers();
      polylines.clear();
    };
  }, []);

  // Toggle traffic layer visibility
  useEffect(() => {
    if (!trafficLayerRef.current || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (layers.traffic) {
      if (!map.hasLayer(trafficLayerRef.current)) {
        trafficLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(trafficLayerRef.current)) {
        map.removeLayer(trafficLayerRef.current);
      }
    }
  }, [layers.traffic]);

  // ─── Spatial Defect Density Heatmap Layer ─────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !heatmapLayerRef.current) return;

    const heatmapLayer = heatmapLayerRef.current;
    heatmapLayer.clearLayers();

    if (!layers.heatmap) return;

    events.forEach((event) => {
      // Calculate severity weight for heatmap gradient
      let weight = 0.5;
      if (event.severity === 'CRITICAL') weight = 1.0;
      else if (event.severity === 'HIGH') weight = 0.75;
      else if (event.severity === 'MEDIUM') weight = 0.5;
      else weight = 0.25;

      const isIncident = event.type === 'ANPR_INCIDENT' || event.type === 'HIT_AND_RUN' || event.type === 'RASH_DRIVING';
      const color = isIncident ? '#dc2626' : weight >= 0.75 ? '#ef4444' : weight >= 0.5 ? '#f59e0b' : '#3b82f6';

      // Outer radial density field
      const outerHalo = L.circleMarker([event.latitude, event.longitude], {
        radius: 34 + weight * 16,
        fillColor: color,
        fillOpacity: 0.16 * weight,
        stroke: false,
        interactive: false,
      });

      // Mid intensity zone
      const midHalo = L.circleMarker([event.latitude, event.longitude], {
        radius: 18 + weight * 10,
        fillColor: color,
        fillOpacity: 0.32 * weight,
        stroke: false,
        interactive: false,
      });

      // Hotspot core
      const coreMarker = L.circleMarker([event.latitude, event.longitude], {
        radius: 7 + weight * 4,
        fillColor: color,
        fillOpacity: 0.75,
        stroke: false,
        interactive: false,
      });

      outerHalo.addTo(heatmapLayer);
      midHalo.addTo(heatmapLayer);
      coreMarker.addTo(heatmapLayer);
    });
  }, [events, layers.heatmap]);

  // ─── Google Maps-Style Bangalore Traffic Density Heatmap Layer ─────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficHeatmapLayerRef.current) return;

    const heatmapLayer = trafficHeatmapLayerRef.current;
    heatmapLayer.clearLayers();

    if (!layers.trafficHeatmap) return;

    BANGALORE_TRAFFIC_HOTSPOTS.forEach((spot) => {
      const meta = getTrafficLevelMetadata(spot.traffic_level);
      const color = meta.color;

      // Tier 1: Soft Outer Radial Density Aura (Google Maps Heatmap look)
      const outerHalo = L.circleMarker([spot.lat, spot.lng], {
        radius: spot.radius * 1.9,
        fillColor: color,
        fillOpacity: 0.2,
        stroke: false,
        interactive: false,
      });

      // Tier 2: Mid Density Zone
      const midHalo = L.circleMarker([spot.lat, spot.lng], {
        radius: spot.radius * 1.15,
        fillColor: color,
        fillOpacity: 0.42,
        stroke: false,
        interactive: false,
      });

      // Tier 3: Core Hotspot Circle (Interactive Clickable Popup)
      const coreMarker = L.circleMarker([spot.lat, spot.lng], {
        radius: Math.max(10, spot.radius * 0.45),
        fillColor: color,
        fillOpacity: 0.88,
        color: '#ffffff',
        weight: 1.5,
        interactive: true,
      });

      const popupContent = `
        <div style="min-width: 230px; font-family: Inter, -apple-system, sans-serif; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase;">
              🚦 ${spot.road}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background-color: ${color}; color: #ffffff;">
              ${spot.traffic_level} CONGESTION
            </span>
            <span style="font-size: 11px; font-weight: 800; color: #d97706;">
              ${spot.congestion}% Congested
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>Vehicle Count:</strong> ${spot.vehicle_count} vehicles/hr
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>Average Speed:</strong> ${spot.avg_speed} km/h
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">
            <strong>Last Updated:</strong> ${spot.last_updated}
          </div>
          <div style="font-size: 9px; font-weight: 800; color: #0284c7; background-color: #e0f2fe; border: 1px solid #7dd3fc; padding: 3px 6px; border-radius: 4px; text-align: center;">
            🚦 DEMO TRAFFIC DATA • BANGALORE FLEET
          </div>
        </div>
      `;

      coreMarker.bindPopup(popupContent);

      outerHalo.addTo(heatmapLayer);
      midHalo.addTo(heatmapLayer);
      coreMarker.addTo(heatmapLayer);
    });
  }, [layers.trafficHeatmap]);

  // Update center when props change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLon], zoom, { animate: true });
    }
  }, [centerLat, centerLon, zoom]);

  // Handle Latest Event Glow Effect
  useEffect(() => {
    if (!mapInstanceRef.current || !latestEventId) return;
    const latestEv = events.find((e) => e.id === latestEventId);
    if (!latestEv) return;

    mapInstanceRef.current.panTo([latestEv.latitude, latestEv.longitude], { animate: true });

    if (pulseCircleRef.current) {
      pulseCircleRef.current.remove();
    }

    const circle = L.circleMarker([latestEv.latitude, latestEv.longitude], {
      radius: 26,
      fillColor: '#ef4444',
      fillOpacity: 0.3,
      color: '#dc2626',
      weight: 2,
    }).addTo(mapInstanceRef.current);

    pulseCircleRef.current = circle;

    const timer = setTimeout(() => {
      if (pulseCircleRef.current) {
        pulseCircleRef.current.remove();
        pulseCircleRef.current = null;
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [latestEventId, events]);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    events.forEach((event) => {
      const isIncident = event.type === 'ANPR_INCIDENT' || event.type === 'HIT_AND_RUN' || event.type === 'RASH_DRIVING';
      
      // Emergency Priority: Active incidents can NEVER be filtered off by default layer toggles
      if (!isIncident) {
        if (!layers.defects && (event.type === 'POTHOLE' || event.type.includes('CRACK') || event.type === 'SURFACE_DAMAGE' || event.type === 'WATERLOGGING')) {
          return;
        }
        if (!layers.traffic && (event.type === 'VEHICLE_FLOW' || event.type === 'TRAFFIC_BOTTLENECK')) {
          return;
        }
        if (!layers.vruSafety && (event.type.includes('ZEBRA') || event.type === 'SCHOOL_CHILDREN_CROSSING' || event.type === 'MISSING_DIVIDER')) {
          return;
        }
      }

      const statusMeta = STATUS_METADATA[event.status] || STATUS_METADATA.NEW;
      const isNew = event.status === 'NEW';
      const isLatest = event.id === latestEventId;
      const markerColor = isIncident ? '#dc2626' : statusMeta.bg;

      const iconHtml = `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${
            isIncident && event.status !== 'RESOLVED'
              ? `<div style="position: absolute; width: 50px; height: 50px; border-radius: 50%; background-color: #dc2626; opacity: 0.75; animation: pulse-ring 0.9s infinite;"></div>`
              : isLatest
              ? `<div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background-color: ${markerColor}; opacity: 0.6; animation: pulse-ring 1.2s infinite;"></div>`
              : isNew
              ? `<div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${markerColor}; opacity: 0.35; animation: pulse-ring 2s infinite;"></div>`
              : ''
          }
          <div style="
            width: ${isIncident ? '30px' : '26px'};
            height: ${isIncident ? '30px' : '26px'};
            border-radius: 50%;
            background-color: ${markerColor};
            border: ${isIncident ? '3px solid #ffffff' : '2px solid #ffffff'};
            box-shadow: ${isIncident ? '0 0 12px rgba(220, 38, 38, 0.8), 0 2px 6px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.35)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: ${isIncident ? '13px' : '11px'};
            font-weight: 800;
            transition: transform 0.15s ease-in-out;
          ">
            ${isIncident ? '🚨' : statusMeta.symbol}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-road-marker',
        html: iconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -19],
      });

      /**
       * Emergency Incident z-index guarantee:
       * Incidents get a massive zOffset (15,000) so they always render physically above
       * all other road defects, potholes, cracks, and road markings.
       */
      const categoryPriority = getCategoryPriority(event.type);
      const zOffset = isIncident ? 15000 : (MAX_CATEGORY_PRIORITY - categoryPriority) * 100;

      const marker = L.marker([event.latitude, event.longitude], {
        icon: customIcon,
        zIndexOffset: zOffset,
      });

      marker.on('click', () => {
        if (onSelectEvent) {
          onSelectEvent(event);
        }
      });

      const dateStr = new Date(event.timestamp).toLocaleString();
      const details = getPotholeCostDetails(event);
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '240px';
      popupDiv.style.fontFamily = 'Inter, -apple-system, sans-serif';

      popupDiv.innerHTML = `
        <div style="padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: ${markerColor}; text-transform: uppercase;">
              ${isIncident ? '🚨 ' + event.type.replace('_', ' ') : event.type.replace('_', ' ')}
            </span>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background-color: ${isIncident ? '#fee2e2' : '#f1f5f9'}; color: ${isIncident ? '#991b1b' : '#334155'};">
              ${Math.round(event.confidence * 100)}% Conf
            </span>
          </div>

          ${
            event.registrationNumber
              ? `<div style="margin-bottom: 8px;">
                  <div style="display: inline-flex; align-items: center; gap: 6px; background-color: #fef2f2; border: 1.5px solid #dc2626; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; box-shadow: 0 1px 3px rgba(220,38,38,0.15);">
                    <span>🚗 PLATE:</span>
                    <span style="font-family: monospace; font-size: 14px;">${event.registrationNumber}</span>
                  </div>
                </div>`
              : ''
          }

          ${
            event.source === 'Citizen Report'
              ? `<div style="margin-bottom: 6px;"><span style="font-size: 9px; font-weight: 800; background-color: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Citizen Report</span></div>`
              : ''
          }

          ${
            event.imageSnippet
              ? `<div style="margin-bottom: 8px; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; max-height: 100px;">
                  <img src="${resolveImageSrc(event.imageSnippet)}" alt="Camera snippet" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'300\\' viewBox=\\'0 0 400 300\\'><rect width=\\'400\\' height=\\'300\\' fill=\\'%231e293b\\'/><path d=\\'M 50 150 Q 200 80 350 150 Q 200 220 50 150 Z\\' fill=\\'%230f172a\\' stroke=\\'%23f97316\\' stroke-width=\\'4\\'/><circle cx=\\'200\\' cy=\\'150\\' r=\\'45\\' fill=\\'%23020617\\'/><text x=\\'200\\' y=\\'240\\' font-family=\\'sans-serif\\' font-size=\\'14\\' font-weight=\\'bold\\' fill=\\'%23f97316\\' text-anchor=\\'middle\\'>EDGE-AI ROAD DEFECT CAPTURE</text></svg>';" style="width: 100%; height: 95px; object-fit: cover; display: block;" />
                </div>`
              : ''
          }

          {/* Cavity & Repair Cost Bar */}
          <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 6px; border: 1px solid #fde68a;">
            <span>Ø ${details.formattedDiameter} (${details.severity})</span>
            <span style="color: #059669; font-weight: 800;">Fix: ${details.formattedCost}</span>
          </div>

          <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
            <strong>Bus:</strong> ${event.busLabel}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">
            <strong>GPS:</strong> ${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
            <strong>Detected:</strong> ${dateStr}
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${statusMeta.bg};">
              ${statusMeta.label}
            </span>
            <button id="btn-view-detail-${event.id}" style="
              background-color: #10233D;
              color: #ffffff;
              border: none;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              min-height: 36px;
            ">
              Action Panel →
            </button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const btn = document.getElementById(`btn-view-detail-${event.id}`);
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            if (onSelectEvent) onSelectEvent(event);
          };
        }
      }, 50);

      marker.bindPopup(popupDiv);
      marker.addTo(layer);
    });
  }, [events, latestEventId, onSelectEvent]);

  return (
    <div className="relative w-full h-full min-h-[360px] sm:min-h-[460px] bg-slate-100 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Right GIS Layer Controls Toggle Panel */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-30 max-w-[calc(100vw-32px)]">
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-2 sm:p-2.5 text-xs text-white space-y-1 sm:space-y-1.5 max-w-[170px] sm:min-w-[180px]">

          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-1 flex items-center justify-between">
            <span>GIS Map Layers</span>
            <Layers className="w-3 h-3 text-teal-400" />
          </div>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.defects}
              onChange={(e) => setLayers({ ...layers, defects: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🛠️ Road Defects</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚗 Traffic Flow</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.trafficHeatmap}
              onChange={(e) => setLayers({ ...layers, trafficHeatmap: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚦 Traffic Heatmap</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.incidents}
              onChange={(e) => setLayers({ ...layers, incidents: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚨 Vehicle Tracker</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.vruSafety}
              onChange={(e) => setLayers({ ...layers, vruSafety: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚶 VRU Safety Risk</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.heatmap}
              onChange={(e) => setLayers({ ...layers, heatmap: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🔥 Defect Heatmap</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.predictive}
              onChange={(e) => setLayers({ ...layers, predictive: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🔮 Predictive Risk</span>
          </label>
        </div>
      </div>

      {/* Map Status Legend Overlay: Collapsible on Mobile, Permanent on Desktop */}
      <div className="absolute bottom-4 left-3 sm:left-4 z-[500] max-w-[240px]">
        {legendOpen ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-3 text-xs text-white animate-fade-in">
            <div className="flex items-center justify-between font-semibold text-slate-200 text-[11px] mb-2 pb-1.5 border-b border-white/10">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1E7F73] animate-pulse" />
                <span>Defect Status Overlay</span>
              </div>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label="Collapse legend"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] inline-block shrink-0" />
                <span className="text-slate-200">New Alert</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block shrink-0" />
                <span className="text-slate-200">Assigned</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E7F73] inline-block shrink-0" />
                <span className="text-slate-200">Resolved</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#475569] inline-block shrink-0" />
                <span className="text-slate-200">Reviewed</span>
              </div>
            </div>

            {congestionSource === 'SCRIPTED_DEMO' && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">Simulated</span>
                <span className="text-[10px] text-amber-200/90">Scripted Bangalore scenario — not fleet data</span>
              </div>
            )}
            {congestionSource === 'FLEET_OBSERVATIONS' && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Live</span>
                <span className="text-[10px] text-emerald-200/90">Derived from bus fleet observations</span>
              </div>
            )}
            {/* Traffic Congestion Legend */}
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Live Traffic</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1.5 rounded bg-[#16a34a] inline-block shrink-0" />
                  <span className="text-slate-200">Free Flow</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1.5 rounded bg-[#d97706] inline-block shrink-0" />
                  <span className="text-slate-200">Moderate</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1.5 rounded bg-[#dc2626] inline-block shrink-0" />
                  <span className="text-slate-200">Heavy</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1.5 rounded bg-[#7f1d1d] inline-block shrink-0" />
                  <span className="text-slate-200">Severe</span>
                </div>
              </div>
            </div>

            {/* Google Maps Traffic Heatmap Legend */}
            {layers.trafficHeatmap && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-300 uppercase tracking-wider mb-1.5">
                  <span>🚦 Traffic Heatmap Density</span>
                  <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded font-mono">DEMO DATA</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold">
                  <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 py-0.5 rounded">LOW</div>
                  <div className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 py-0.5 rounded">MEDIUM</div>
                  <div className="bg-orange-500/20 text-orange-300 border border-orange-500/40 py-0.5 rounded">HIGH</div>
                  <div className="bg-red-500/20 text-red-300 border border-red-500/40 py-0.5 rounded">SEVERE</div>
                </div>
                <div className="mt-1.5 text-[9px] text-slate-400 font-mono text-center">
                  Bangalore Hotspots: LOW → MEDIUM → HIGH → SEVERE
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-lg active:scale-95 transition min-h-[40px]"
            title="Tap to expand status legend"
            aria-label="Expand defect legend"
          >
            <Layers className="w-3.5 h-3.5 text-[#1E7F73]" />
            <span>Legend</span>
            <ChevronUp className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* DEMO TRAFFIC DATA Badge Overlay (Requirement #18) */}
      {layers.trafficHeatmap && (
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-30 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-extrabold flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>🚦 DEMO TRAFFIC DATA • BANGALORE FLEET</span>
          </div>
        </div>
      )}
    </div>
  );
};

