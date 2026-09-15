import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RoadEvent, EventStatus, SegmentCongestionState, CongestionLevel, CongestionSource } from '../types';
import { ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { getCategoryPriority, MAX_CATEGORY_PRIORITY } from '../constants/detectionCategories';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { resolveImageSrc } from '../utils/imageUtils';
import { useTheme } from '../contexts/ThemeContext';
import { getCongestionState, subscribeToCongestionUpdates, getIndiaTraffic } from '../services/congestionService';
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
  activeLayerFilters = { defects: true, traffic: true, incidents: true, vruSafety: true, predictive: true, heatmap: true },
}) => {
  const { isDark } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const defectMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const vruLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficLayerRef = useRef<L.LayerGroup | null>(null);
  const busLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficPolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const pulseCircleRef = useRef<L.CircleMarker | null>(null);

  // Layer toggle state
  const [layers, setLayers] = useState({
    defects: activeLayerFilters.defects ?? true,
    traffic: activeLayerFilters.traffic ?? true,
    incidents: activeLayerFilters.incidents ?? true,
    vruSafety: activeLayerFilters.vruSafety ?? true,
    predictive: activeLayerFilters.predictive ?? true,
    heatmap: activeLayerFilters.heatmap ?? true,
  });

  const [visibleRoadClasses, setVisibleRoadClasses] = useState<string[]>(['trunk', 'motorway']);

  // Collapsible legend state
  const [legendOpen, setLegendOpen] = useState(false);
  // Provenance of the congestion overlay. Surfaced on the map, because an overlay
  // animating over real OSM geometry is indistinguishable from measured traffic.
  const [congestionSource, setCongestionSource] = useState<CongestionSource>('NONE');
  const [liveBusCount, setLiveBusCount] = useState(0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [22.5, 82.0],
        zoom: 5,
        zoomControl: false, // Repositioned zoom control
      });

      map.on('zoomend', () => {
        const z = map.getZoom();
        if (z <= 6) setVisibleRoadClasses(['trunk', 'motorway']);
        else if (z <= 9) setVisibleRoadClasses(['trunk', 'motorway', 'primary']);
        else if (z <= 11) setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary']);
        else setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
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

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Traffic congestion polyline layer — renders below markers
      const trafficLayer = L.layerGroup().addTo(map);
      trafficLayerRef.current = trafficLayer;

      // Live bus positions — above defects, so a moving vehicle is never hidden
      const busLayer = L.layerGroup().addTo(map);
      busLayerRef.current = busLayer;

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

  // ─── Live Bus Fleet Layer ──────────────────────────────────────────────────
  // A bus appears as soon as it reports a position — which every detection carries,
  // so this works with any build of the mobile app. Markers are reused and moved
  // rather than recreated, so a bus slides along the road instead of blinking.
  useEffect(() => {
    if (!mapInstanceRef.current || !busLayerRef.current) return;
    const busLayer = busLayerRef.current;
    const markers = busMarkersRef.current;

    const busIcon = (bus: BusPosition) => {
      const colour = bus.isLive ? '#1E7F73' : '#64748b';
      const pulse = bus.isLive
        ? '<span style="position:absolute;inset:-6px;border-radius:9999px;background:' + colour + '33;animation:urbaneyePulse 2s ease-out infinite"></span>'
        : '';
      const heading = typeof bus.headingDeg === 'number'
        ? '<span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%) rotate(' + bus.headingDeg + 'deg);color:' + colour + ';font-size:10px;line-height:1">&#9650;</span>'
        : '';
      return L.divIcon({
        className: 'urbaneye-bus-marker',
        html:
          '<div style="position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px">' +
          pulse + heading +
          '<div style="position:relative;width:24px;height:24px;border-radius:9999px;background:' + colour +
          ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:13px">&#128653;</div>' +
          '</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
    };

    const popupFor = (bus: BusPosition) => {
      const speed = typeof bus.speedKmh === 'number' ? Math.round(bus.speedKmh) + ' km/h' : 'speed unknown';
      const seen = new Date(bus.lastSeenAt).toLocaleTimeString();
      return (
        '<div style="font-family:ui-sans-serif,system-ui;min-width:170px">' +
        '<div style="font-weight:800;margin-bottom:2px">' + bus.busLabel + '</div>' +
        (bus.routeTag ? '<div style="font-size:11px;color:#64748b">' + bus.routeTag + '</div>' : '') +
        '<div style="font-size:11px;margin-top:6px">' + speed + '</div>' +
        '<div style="font-size:11px;color:#64748b">last report ' + seen + '</div>' +
        '<div style="font-size:11px;color:' + (bus.isLive ? '#1E7F73' : '#64748b') + ';font-weight:700;margin-top:4px">' +
        (bus.isLive ? 'LIVE' : 'STALE') + '</div></div>'
      );
    };

    const upsert = (bus: BusPosition) => {
      const existing = markers.get(bus.sessionId);
      if (existing) {
        existing.setLatLng([bus.latitude, bus.longitude]);
        existing.setIcon(busIcon(bus));
        existing.setPopupContent(popupFor(bus));
      } else {
        const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon(bus), zIndexOffset: 1200 })
          .bindPopup(popupFor(bus))
          .addTo(busLayer);
        marker.on('click', () => {
          if (mapInstanceRef.current) {
            const curZ = mapInstanceRef.current.getZoom();
            const targetZ = Math.max(curZ, 15);
            mapInstanceRef.current.flyTo([bus.latitude, bus.longitude], targetZ, {
              animate: true,
              duration: 1.0,
            });
          }
        });
        markers.set(bus.sessionId, marker);
      }
      setLiveBusCount(markers.size);
    };

    getFleet().then(({ buses }) => buses.forEach(upsert));

    const unsub = subscribeToFleet(upsert, (sessionId) => {
      const marker = markers.get(sessionId);
      if (marker) {
        busLayer.removeLayer(marker);
        markers.delete(sessionId);
        setLiveBusCount(markers.size);
      }
    });

    // Buses go quiet between routes; refresh so stale markers grey out.
    const poll = setInterval(() => getFleet().then(({ buses }) => buses.forEach(upsert)), 30000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, []);

  // ─── Traffic Congestion Layer ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;

    const trafficLayer = trafficLayerRef.current;
    const polylines = trafficPolylinesRef.current;

    trafficLayer.clearLayers();
    polylines.clear();

    getIndiaTraffic(visibleRoadClasses).then(({ segments, dataSource }) => {
      setCongestionSource(dataSource);
      if (segments.length === 0) return;
      
      segments.forEach((seg) => {
        if (!visibleRoadClasses.includes(seg.roadClass)) return;
        if (!seg.coordinates || seg.coordinates.length < 2) return;
        
        const latLngs = seg.coordinates.map(([lat, lng]: [number, number]) => L.latLng(lat, lng));
        const weight = seg.roadClass === 'trunk' || seg.roadClass === 'motorway' ? 5 : seg.roadClass === 'primary' ? 4 : 3;
        const polyline = L.polyline(latLngs, {
          color: seg.color || '#16a34a',
          weight,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
          smoothFactor: 1.0,
        });

        const levelLabel = (seg.level || 'FREE_FLOW').replace('_', ' ');
        const popupContent = `
<div style="font-family:Inter,sans-serif;min-width:220px;padding:4px">
  <div style="font-size:9px;font-weight:800;color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:4px;margin-bottom:6px;text-align:center">⚠ DEMO TRAFFIC DATA</div>
  <div style="font-weight:800;font-size:13px;margin-bottom:4px">${seg.name || 'Road Segment'}</div>
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
    <span style="width:10px;height:10px;border-radius:50%;background:${seg.color}"></span>
    <span style="font-weight:700;font-size:12px;color:${seg.color}">${levelLabel}</span>
  </div>
  <div style="font-size:11px;color:#475569;margin-bottom:2px">Congestion: <strong>${seg.congestionPct || seg.score}%</strong></div>
  <div style="font-size:11px;color:#475569;margin-bottom:2px">Avg Speed: <strong>${seg.avgSpeedKmh || '—'} km/h</strong></div>
  <div style="font-size:11px;color:#475569;margin-bottom:2px">Vehicles: <strong>~${seg.vehicleCountPerHour ? seg.vehicleCountPerHour.toLocaleString() : '—'}/hr</strong></div>
  <div style="font-size:11px;color:#64748b">City: <strong>${seg.cityTag}</strong> · Class: ${seg.roadClass}</div>
  <div style="font-size:9px;color:#94a3b8;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:4px">Simulated scenario — not real-time fleet data</div>
</div>`;
        polyline.bindPopup(popupContent);
        polyline.on('click', () => {
          if (mapInstanceRef.current) {
            const bounds = polyline.getBounds();
            if (bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, {
                maxZoom: 15,
                padding: [45, 45],
                animate: true,
              });
            }
          }
        });
        polyline.addTo(trafficLayer);
        polylines.set(seg.segmentId, polyline);
      });
    });

    const unsub = subscribeToCongestionUpdates((payload) => {
      if (!payload.updates) return;
      payload.updates.forEach((update) => {
        const existing = polylines.get(update.segmentId);
        if (existing) {
          existing.setStyle({ color: update.color });
        }
      });
    });

    return () => {
      unsub();
      trafficLayer.clearLayers();
      polylines.clear();
    };
  }, [visibleRoadClasses, layers.traffic]);

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

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (mapInstanceRef.current) {
      setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
      mapInstanceRef.current.flyTo([centerLat, centerLon], 13, { animate: true, duration: 1.2 });
    }
  }, [centerLat, centerLon]);

  // Handle Latest Event Glow & Zoom Focus Effect
  useEffect(() => {
    if (!mapInstanceRef.current || !latestEventId) return;
    const latestEv = events.find((e) => e.id === latestEventId);
    if (!latestEv) return;

    const curZ = mapInstanceRef.current.getZoom();
    const targetZ = Math.max(curZ, 15);
    mapInstanceRef.current.flyTo([latestEv.latitude, latestEv.longitude], targetZ, {
      animate: true,
      duration: 1.0,
    });

    const marker = defectMarkersRef.current.get(latestEv.id);
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }

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
    defectMarkersRef.current.clear();

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
        if (mapInstanceRef.current) {
          const curZ = mapInstanceRef.current.getZoom();
          const targetZ = Math.max(curZ, 15);
          mapInstanceRef.current.flyTo([event.latitude, event.longitude], targetZ, {
            animate: true,
            duration: 1.0,
          });
        }
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
      defectMarkersRef.current.set(event.id, marker);
    });
  }, [events, latestEventId, onSelectEvent]);

  return (
    <div className="relative w-full h-full min-h-[360px] sm:min-h-[460px] bg-slate-100 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Left Quick Navigation Switcher */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-30 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-xl max-w-[calc(100vw-180px)]">
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              setVisibleRoadClasses(['trunk', 'motorway']);
              mapInstanceRef.current.flyTo([22.5, 82.0], 5, { animate: true, duration: 1.2 });
            }
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
        >
          🇮🇳 India View
        </button>
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
              mapInstanceRef.current.flyTo([12.9716, 77.5946], 13, { animate: true, duration: 1.2 });
            }
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white transition flex items-center gap-1"
        >
          <span>🏙️</span>
          <span>Bengaluru City</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
              mapInstanceRef.current.flyTo([19.0760, 72.8777], 13, { animate: true, duration: 1.2 });
            }
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition flex items-center gap-1"
        >
          <span>🌊</span>
          <span>Mumbai City</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
              mapInstanceRef.current.flyTo([31.3800, 75.3800], 14, { animate: true, duration: 1.2 });
            }
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white transition flex items-center gap-1"
        >
          <span>📍</span>
          <span>Kapurthala</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              setVisibleRoadClasses(['trunk', 'motorway', 'primary', 'secondary', 'tertiary']);
              mapInstanceRef.current.flyTo([31.1471, 75.3412], 9, { animate: true, duration: 1.2 });
            }
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white transition flex items-center gap-1"
        >
          <span>🌾</span>
          <span>Punjab State</span>
        </button>
      </div>

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
            <span>📢 Citizen Reports</span>
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

            {liveBusCount > 0 && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-[#1E7F73]/40 bg-[#1E7F73]/15 px-2.5 py-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-300">Fleet</span>
                <span className="text-[10px] text-teal-100/90">
                  {liveBusCount} bus{liveBusCount === 1 ? '' : 'es'} reporting position
                </span>
              </div>
            )}
            <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">Demo</span>
              <span className="text-[10px] text-amber-200/90">Nationwide demo traffic — not real-time data</span>
            </div>
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
    </div>
  );
};

