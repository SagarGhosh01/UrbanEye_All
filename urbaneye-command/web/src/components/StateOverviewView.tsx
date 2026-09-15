import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { api } from '../services/api';
import { State, District, DistrictSummaryItem, HierarchySummary } from '../types';
import {
  Bus, AlertTriangle, Wrench, CheckCircle2, Activity,
  ArrowRight, ArrowLeft, RefreshCw, MapPin, Layers, Building2,
} from 'lucide-react';

interface StateOverviewViewProps {
  state: State;
  onSelectDistrict: (district: District) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export const StateOverviewView: React.FC<StateOverviewViewProps> = ({
  state,
  onSelectDistrict,
  onBack,
  canGoBack = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState<DistrictSummaryItem[]>([]);
  const [summary, setSummary] = useState<HierarchySummary | null>(null);
  const [stateFleet, setStateFleet] = useState<any[]>([]);

  const [mapLayers, setMapLayers] = useState({
    densityHeatmap: true,
    liveFleet: true,
    districtHealth: true,
  });

  // Mobile Segmented View Switcher: 'map' vs 'districts'
  const [mobileTab, setMobileTab] = useState<'map' | 'districts'>('districts');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const densityLayerRef = useRef<L.LayerGroup | null>(null);
  const fleetLayerRef = useRef<L.LayerGroup | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSummary, resFleet] = await Promise.all([
        api.getStateSummary(state.id),
        api.getLiveFleet({ stateId: state.id }),
      ]);
      setDistricts(resSummary.districts);
      setSummary(resSummary.summary);
      setStateFleet(resFleet.fleet || []);
    } catch (err) {
      console.error('Failed to load state summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.id]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [state.centerLat, state.centerLon],
        zoom: 8,
        zoomControl: false,
      });

      // Zoom control at bottom-right for thumb ergonomics
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const densityLayer = L.layerGroup().addTo(map);
      densityLayerRef.current = densityLayer;

      const fleetLayer = L.layerGroup().addTo(map);
      fleetLayerRef.current = fleetLayer;

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([state.centerLat, state.centerLon], 8);
    }

    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [state.id]);

  // Invalidate map on mobile tab switch
  useEffect(() => {
    if (mobileTab === 'map') {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // ─── State Vehicle Density Heatmap & Fleet Pings Render ─────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !densityLayerRef.current || !fleetLayerRef.current) return;
    const densityLayer = densityLayerRef.current;
    const fleetLayer = fleetLayerRef.current;

    densityLayer.clearLayers();
    fleetLayer.clearLayers();

    // 1. Density Heatmap Halos over Districts & Active Bus Clusters
    if (mapLayers.densityHeatmap) {
      districts.forEach((d) => {
        const busCount = d.activeBusesCount || 1;
        const color = d.roadHealthScore >= 80 ? '#22c55e' : d.roadHealthScore >= 60 ? '#f97316' : '#ef4444';
        const halo = L.circleMarker([d.centerLat, d.centerLon], {
          radius: 35 + busCount * 12,
          fillColor: color,
          fillOpacity: 0.22,
          stroke: false,
          interactive: true,
        });

        halo.bindTooltip(`
          <div style="font-family:sans-serif;font-size:11px;padding:3px;">
            <strong style="color:#0f172a;font-size:12px;">${d.name} (${d.code})</strong><br/>
            <span>Active Patrol Fleet: <strong>${d.activeBusesCount} Buses</strong></span><br/>
            <span>Road Health Index: <strong>${d.roadHealthScore}/100</strong></span>
          </div>
        `, { sticky: true });

        halo.addTo(densityLayer);
      });
    }

    // 2. Live Bus Fleet GPS Markers
    if (mapLayers.liveFleet && stateFleet.length > 0) {
      stateFleet.forEach((bus) => {
        const busIcon = L.divIcon({
          className: 'custom-state-bus-marker',
          html: `
            <div style="background:#1E7F73;color:white;border-radius:6px;padding:2px 5px;font-weight:700;font-size:9px;border:1.5px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;white-space:nowrap;">
              <span>🚌</span><span>${bus.busLabel}</span>
            </div>`,
          iconSize: [65, 20],
          iconAnchor: [32, 10],
        });

        const m = L.marker([bus.latitude, bus.longitude], { icon: busIcon });
        m.bindTooltip(`
          <div style="font-family:sans-serif;font-size:11px;padding:3px;">
            <strong style="color:#10233D;">${bus.busLabel}</strong><br/>
            Route: <strong>${bus.routeTag || 'State Highway'}</strong><br/>
            Speed: <strong>${bus.speedKmh} km/h</strong>
          </div>
        `);
        m.addTo(fleetLayer);
      });
    }
  }, [districts, stateFleet, mapLayers]);

  // Render District Health Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || districts.length === 0) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    if (!mapLayers.districtHealth) return;

    districts.forEach((dist) => {
      const getHealthColor = (s: number) => (s >= 80 ? '#1E7F73' : s >= 60 ? '#d97706' : '#dc2626');
      const healthColor = getHealthColor(dist.roadHealthScore);
      const iconHtml = `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="width:36px;height:36px;border-radius:50%;background-color:#0f172a;border:2.5px solid ${healthColor};box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;">
            <span style="color:${healthColor};font-weight:900;">${dist.roadHealthScore}</span>
          </div>
        </div>`;
      const customIcon = L.divIcon({
        className: 'custom-district-marker',
        html: iconHtml,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -21],
      });
      const marker = L.marker([dist.centerLat, dist.centerLon], { icon: customIcon });
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '220px';
      popupDiv.style.fontFamily = 'Inter, sans-serif';
      popupDiv.innerHTML = `
        <div style="padding:2px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <h4 style="font-size:13px;font-weight:800;color:#0f172a;margin:0;">${dist.name}</h4>
            <span style="font-size:10px;font-weight:700;background:#e2e8f0;color:#334155;padding:2px 6px;border-radius:4px;">${dist.code}</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;">Sensors: <strong>${dist.activeBusesCount}</strong> • Health: <strong style="color:${healthColor};">${dist.roadHealthScore}/100</strong></div>
          <div style="grid-template-columns:repeat(3,1fr);display:grid;gap:4px;font-size:10px;margin-bottom:10px;text-align:center;">
            <div style="background:#fee2e2;color:#991b1b;padding:4px;border-radius:4px;font-weight:700;">${dist.newDefects} New</div>
            <div style="background:#fef3c7;color:#92400e;padding:4px;border-radius:4px;font-weight:700;">${dist.assignedDefects} Asgd</div>
            <div style="background:#ecfdf5;color:#065f46;padding:4px;border-radius:4px;font-weight:700;">${dist.resolvedDefects} Rslv</div>
          </div>
          <button id="btn-enter-district-${dist.id}" style="width:100%;background-color:#10233D;color:white;border:none;padding:8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;min-height:36px;">Launch District Command →</button>
        </div>`;
      setTimeout(() => {
        const btn = document.getElementById(`btn-enter-district-${dist.id}`);
        if (btn)
          btn.onclick = () =>
            onSelectDistrict({
              id: dist.id,
              code: dist.code,
              name: dist.name,
              stateId: state.id,
              centerLat: dist.centerLat,
              centerLon: dist.centerLon,
            });
      }, 50);
      marker.bindPopup(popupDiv);
      marker.on('click', () => onSelectDistrict({
        id: dist.id,
        code: dist.code,
        name: dist.name,
        stateId: state.id,
        centerLat: dist.centerLat,
        centerLon: dist.centerLon,
      }));
      marker.addTo(layer);
    });
  }, [districts, state.id, onSelectDistrict, mapLayers.districtHealth]);

  /* ── Dark tokens ── */
  const card = 'bg-slate-800 border-slate-700';
  const miniCard = 'bg-slate-900/60 border-slate-700';
  const label = 'text-slate-400';
  const numClr = 'text-white';
  const hint = 'text-slate-500';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Top Banner ──────────────────────────────────────────── */}
      <div className={`rounded-xl border shadow-sm p-4 sm:p-5 ${card}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3">
            {canGoBack && onBack && (
              <button
                onClick={onBack}
                className="p-2.5 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 transition min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                title="Return to National Overview"
                aria-label="Back to National Overview"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#10233D] text-white">
                  State Administration: {state.name} ({state.code})
                </span>
                <span className={`text-xs font-semibold ${label}`}>{districts.length} Jurisdictions</span>
              </div>
              <h1 className={`text-lg sm:text-xl font-black tracking-tight mt-1 ${numClr}`}>
                {state.name} Road Infrastructure Command
              </h1>
              <p className={`text-xs mt-0.5 ${hint}`}>
                Aggregated road intelligence across all districts, bus patrol fleets, and work orders.
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-200 transition flex items-center space-x-1.5 self-start sm:self-auto active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync State Feed</span>
          </button>
        </div>

        {/* State Summary Counters: 2-col on mobile, 5-col on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {[
            {
              icon: <Bus className="w-3.5 h-3.5 text-indigo-400" />,
              label: 'Active Buses',
              value: summary?.totalActiveBuses || 0,
              hint: 'Patrol Sensors',
              cls: numClr,
            },
            {
              icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
              label: 'New Defects',
              value: summary?.totalNewDefects || 0,
              hint: 'Unreviewed',
              cls: 'text-red-400',
            },
            {
              icon: <Wrench className="w-3.5 h-3.5 text-orange-400" />,
              label: 'Assigned Repair',
              value: summary?.totalAssignedDefects || 0,
              hint: 'Work Orders',
              cls: 'text-orange-400',
            },
            {
              icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
              label: 'Resolved',
              value: summary?.totalResolvedDefects || 0,
              hint: 'Completed',
              cls: 'text-emerald-400',
            },
            {
              icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
              label: 'State Road Health',
              value: summary?.averageRoadHealthIndex || 100,
              hint: 'Average Score',
              cls: 'text-blue-400',
              suffix: '/100',
            },
          ].map((m, i) => (
            <div
              key={i}
              className={`p-3 sm:p-3.5 rounded-xl border ${miniCard} ${
                i === 4 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <span className={`text-[11px] font-semibold ${label} flex items-center space-x-1 mb-1 truncate`}>
                {m.icon}
                <span className="truncate">{m.label}</span>
              </span>
              <div className={`text-xl sm:text-2xl font-black ${m.cls}`}>
                {m.value}
                {m.suffix && <span className="text-xs font-bold text-slate-500 ml-0.5">{m.suffix}</span>}
              </div>
              <span className={`text-[10px] block truncate ${hint}`}>{m.hint}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile Segmented View Switcher (< md) ────────────────────── */}
      <div className="md:hidden flex rounded-xl p-1 bg-slate-900/90 border border-slate-700 text-xs font-bold shadow-sm">
        <button
          type="button"
          onClick={() => {
            setMobileTab('districts');
          }}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 min-h-[44px] transition ${
            mobileTab === 'districts'
              ? 'bg-[#1E7F73] text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Districts ({districts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab('map');
            setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
          }}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 min-h-[44px] transition ${
            mobileTab === 'map'
              ? 'bg-[#1E7F73] text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Regional Map</span>
        </button>
      </div>

      {/* ── State Regional Map (Full width on desktop, tab-switched on mobile) ── */}
      <div
        className={`rounded-xl border shadow-sm overflow-hidden flex-col ${card} ${
          mobileTab === 'map' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className={`p-3.5 border-b flex items-center justify-between ${miniCard}`}>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>{state.name} District Regional Intelligence Map</span>
          </div>
          <span className={`text-[11px] font-medium ${hint}`}>Click pin to launch district</span>
        </div>
        <div className="h-[360px] sm:h-[440px] w-full relative">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Top-Right Map Layers Toggle Switcher */}
          <div className="absolute top-3 right-3 sm:right-4 z-[500] bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-2.5 shadow-xl text-xs space-y-1.5 text-slate-200">
            <div className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              State Map Layers
            </div>

            <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium hover:text-white transition">
              <input
                type="checkbox"
                checked={mapLayers.densityHeatmap}
                onChange={(e) => setMapLayers({ ...mapLayers, densityHeatmap: e.target.checked })}
                className="rounded text-teal-500 focus:ring-0"
              />
              <span>🔥 Vehicle Density Heatmap</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium hover:text-white transition">
              <input
                type="checkbox"
                checked={mapLayers.liveFleet}
                onChange={(e) => setMapLayers({ ...mapLayers, liveFleet: e.target.checked })}
                className="rounded text-teal-500 focus:ring-0"
              />
              <span>🚌 Live Bus Fleet GPS Pings</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium hover:text-white transition">
              <input
                type="checkbox"
                checked={mapLayers.districtHealth}
                onChange={(e) => setMapLayers({ ...mapLayers, districtHealth: e.target.checked })}
                className="rounded text-teal-500 focus:ring-0"
              />
              <span>🏛️ District Health Markers</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── District Cards Grid ────────────────────────────────────── */}
      <div className={mobileTab === 'districts' ? 'block' : 'hidden md:block'}>
        <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-wider mb-3 ${label} flex items-center justify-between`}>
          <span>Operational Districts ({districts.length})</span>
          <span className="text-[11px] font-normal text-slate-500">Tap to open district command center</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {districts.map((d) => (
            <div
              key={d.id}
              onClick={() =>
                onSelectDistrict({
                  id: d.id,
                  code: d.code,
                  name: d.name,
                  stateId: state.id,
                  centerLat: d.centerLat,
                  centerLon: d.centerLon,
                })
              }
              className={`rounded-xl border p-4 sm:p-5 shadow-sm hover:shadow-lg hover:border-[#1E7F73] transition cursor-pointer flex flex-col justify-between group active:scale-[0.99] ${card}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/40 text-blue-300 border border-blue-700/50">
                    {d.code}
                  </span>
                  <span className="text-xs text-[#1E7F73] font-semibold flex items-center group-hover:translate-x-0.5 transition">
                    Open Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>
                <h3 className={`text-base font-bold mb-1 ${numClr}`}>{d.name}</h3>
                <p className={`text-xs mb-3 flex items-center ${hint}`}>
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500 shrink-0" />
                  Center: {d.centerLat.toFixed(4)}, {d.centerLon.toFixed(4)}
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-700 text-xs">
                <div className="flex items-center justify-between">
                  <span className={label}>Active Bus Sensors:</span>
                  <span className={`font-bold ${numClr}`}>{d.activeBusesCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={label}>Total Defect Events:</span>
                  <span className={`font-bold ${numClr}`}>{d.totalDefects}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-center font-bold">
                  <div className="bg-red-900/40 text-red-300 p-1.5 rounded border border-red-800/50">
                    {d.newDefects} New
                  </div>
                  <div className="bg-orange-900/40 text-orange-300 p-1.5 rounded border border-orange-800/50">
                    {d.assignedDefects} Asgd
                  </div>
                  <div className="bg-emerald-900/40 text-emerald-300 p-1.5 rounded border border-emerald-800/50">
                    {d.resolvedDefects} Rslv
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11px] font-medium ${label}`}>Road Health Index:</span>
                  <span className="text-xs font-extrabold text-blue-400">{d.roadHealthScore}/100</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
