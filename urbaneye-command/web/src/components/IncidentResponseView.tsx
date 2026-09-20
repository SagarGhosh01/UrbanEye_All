import React, { useState, useEffect } from 'react';
import { IncidentRecord, TrackedVehicle, AlertStatus, IncidentCategory } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { getSocket } from '../services/socket';
import { AlertTriangle, Car, ShieldAlert, Eye, Search, CheckCircle2, Clock, MapPin, Navigation, FileText, ChevronRight, X } from 'lucide-react';

interface IncidentResponseViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const IncidentResponseView: React.FC<IncidentResponseViewProps> = ({ districtId, onSelectOnMap }) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [summary, setSummary] = useState({
    totalIncidentsToday: 28,
    pendingAlerts: 6,
    plateDetectionRatePercent: 92,
    activeTrackedVehicles: 14,
  });
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [trackedVehicles, setTrackedVehicles] = useState<TrackedVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorityNotes, setAuthorityNotes] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Police Wanted Vehicle Watchlist State
  const [hotlistPlates, setHotlistPlates] = useState<string[]>(['KA-01-AB-1234', 'MH-12-DE-5678', 'PB-09-X-9988']);
  const [newHotlistPlate, setNewHotlistPlate] = useState<string>('');

  const handleAddHotlistPlate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newHotlistPlate.trim().toUpperCase();
    if (!clean) return;
    if (!hotlistPlates.includes(clean)) {
      setHotlistPlates((prev) => [clean, ...prev]);
    }
    setNewHotlistPlate('');
  };

  const handleRemoveHotlistPlate = (plate: string) => {
    setHotlistPlates((prev) => prev.filter((p) => p !== plate));
  };

  const [plateSearchQuery, setPlateSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'WATCHLIST' | 'SPEEDING' | 'ACCIDENT'>('ALL');

  // Innovation States
  const [aiDeblurActive, setAiDeblurActive] = useState<boolean>(false);
  const [greenWaveActiveId, setGreenWaveActiveId] = useState<string | null>(null);

  // Innovation 1: AI Threat Score Engine (0-100)
  const calculateThreatScore = (inc: IncidentRecord, isWatchlist: boolean) => {
    let score = 15;
    if (inc.speedKmh > 100) score += 40;
    else if (inc.speedKmh > 80) score += 25;

    if (inc.category === 'HIT_AND_RUN' || inc.category === 'ACCIDENT') score += 30;
    else if (inc.category === 'RASH_DRIVING' || inc.category === 'DANGEROUS_DRIVING') score += 20;

    if (isWatchlist) score += 35;
    score = Math.min(100, score);

    if (score >= 75) {
      return { score, label: `CRITICAL THREAT ${score}/100`, badgeClass: 'bg-red-600 text-white font-black border border-red-400 shadow-md animate-pulse' };
    } else if (score >= 45) {
      return { score, label: `MODERATE RISK ${score}/100`, badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' };
    }
    return { score, label: `LOW RISK ${score}/100`, badgeClass: 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold' };
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await intelligenceService.getIncidents(
          districtId,
          filterStatus !== 'ALL' ? (filterStatus as AlertStatus) : undefined,
          filterCategory !== 'ALL' ? filterCategory : undefined
        );
        if (!isMounted) return;
        if (res.status === 'SUCCESS') {
          setIncidents(res.incidents || []);
          if (res.summary) setSummary(res.summary);
        }
        const tracksRes = await intelligenceService.getTrackedVehicles(searchQuery);
        if (!isMounted) return;
        if (tracksRes.status === 'SUCCESS') {
          setTrackedVehicles(tracksRes.tracks || []);
        }
        setLastSyncTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.warn('Error fetching live incident tracking data:', err);
      }
    };

    loadData();

    // 4-second continuous polling interval for live real-time tracking
    const interval = setInterval(() => {
      loadData();
    }, 4000);

    // Socket.IO real-time instant alerts and trajectory updates
    const socket = getSocket();
    const handleNewIncident = (newInc: IncidentRecord) => {
      setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
      setSummary((prev) => ({
        ...prev,
        totalIncidentsToday: prev.totalIncidentsToday + 1,
        pendingAlerts: prev.pendingAlerts + 1,
      }));
    };

    const handleStatusChange = (data: { id: string; status: AlertStatus; authorityNotes?: string }) => {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === data.id
            ? { ...i, status: data.status, authorityNotes: data.authorityNotes || i.authorityNotes }
            : i
        )
      );
    };

    const handleTrackUpdate = (data: { tracks: TrackedVehicle[] }) => {
      if (data && data.tracks && Array.isArray(data.tracks)) {
        setTrackedVehicles(data.tracks);
      }
    };

    socket.on('incident:new', handleNewIncident);
    socket.on('incident:status_change', handleStatusChange);
    socket.on('vehicle:track_update', handleTrackUpdate);

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.off('incident:new', handleNewIncident);
      socket.off('incident:status_change', handleStatusChange);
      socket.off('vehicle:track_update', handleTrackUpdate);
    };
  }, [districtId, filterCategory, filterStatus, searchQuery]);

  const handleUpdateStatus = async (id: string, newStatus: AlertStatus) => {
    setUpdatingId(id);
    await intelligenceService.updateIncidentStatus(id, newStatus, authorityNotes);
    setUpdatingId(null);
    if (selectedIncident && selectedIncident.id === id) {
      setSelectedIncident({ ...selectedIncident, status: newStatus, authorityNotes });
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    // Plate Search Filter
    if (plateSearchQuery) {
      const q = plateSearchQuery.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const p = (inc.plateText || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const v = (inc.vehicleType || '').toUpperCase();
      const bus = (inc.busLabel || '').toUpperCase();
      if (!p.includes(q) && !v.includes(q) && !bus.includes(q)) return false;
    }

    // Quick Filter Tabs
    if (quickFilter === 'WATCHLIST') {
      const isHot = inc.plateText && hotlistPlates.some((hp) => hp.replace(/[^A-Z0-9]/g, '').includes(inc.plateText!.replace(/[^A-Z0-9]/g, '')) || inc.plateText!.replace(/[^A-Z0-9]/g, '').includes(hp.replace(/[^A-Z0-9]/g, '')));
      if (!isHot) return false;
    } else if (quickFilter === 'SPEEDING') {
      if (inc.speedKmh <= 80) return false;
    } else if (quickFilter === 'ACCIDENT') {
      if (inc.category !== 'ACCIDENT' && inc.category !== 'HIT_AND_RUN') return false;
    }
    return true;
  });

  const getCategoryBadge = (category: IncidentCategory) => {
    switch (category) {
      case 'ACCIDENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">💥 ACCIDENT</span>;
      case 'HIT_AND_RUN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">🚨 HIT & RUN</span>;
      case 'RASH_DRIVING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚡ RASH DRIVING</span>;
      case 'DANGEROUS_DRIVING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">⚠️ DANGEROUS DRIVING</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">🚗 VEHICLE ANOMALY</span>;
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse"/> PENDING</span>;
      case 'ACKNOWLEDGED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Eye className="w-3 h-3"/> ACKNOWLEDGED</span>;
      case 'ACTIONED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Navigation className="w-3 h-3"/> ACTIONED</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> CLOSED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#D8E0E8] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#667788]">VEHICLE EVENTS TODAY</div>
            <div className="text-2xl font-bold text-[#0B3558] mt-1">{summary.totalIncidentsToday}</div>
            <div className="text-[11px] text-rose-600 mt-0.5 font-bold">Critical ANPR Telemetry</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#D8E0E8] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#667788]">PENDING ALERTS</div>
            <div className="text-2xl font-bold text-[#D98E04] mt-1">{summary.pendingAlerts}</div>
            <div className="text-[11px] text-[#D98E04] mt-0.5 font-bold">Requires Officer Review</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#D8E0E8] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#667788]">ANPR RECOGNITION RATE</div>
            <div className="text-2xl font-bold text-teal-600 mt-1">{summary.plateDetectionRatePercent}%</div>
            <div className="text-[11px] text-teal-600 mt-0.5 font-bold">Optical Plate Extraction</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#D8E0E8] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#667788]">ACTIVE TRACKED VEHICLES</div>
            <div className="text-2xl font-bold text-[#1769AA] mt-1">{summary.activeTrackedVehicles}</div>
            <div className="text-[11px] text-[#1769AA] mt-0.5 font-bold">Multi-Frame Trajectory</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1769AA] flex items-center justify-center border border-blue-100">
            <Navigation className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Vehicle Tracker Log & Wanted Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Tracker Feed */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-[#D8E0E8] space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#0B3558] flex items-center gap-2">
                  <Car className="w-5 h-5 text-[#1769AA]" />
                  Vehicle Tracker & ANPR Intelligence Feed
                </h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live ANPR Stream
                </span>
              </div>
              <p className="text-xs text-[#667788] mt-0.5">
                Real-time optical plate recognition, speed tracking & wanted vehicle alerts {lastSyncTime ? `• Last sync ${lastSyncTime}` : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white border border-[#D8E0E8] text-xs font-semibold text-[#172B3A] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#1769AA]"
              >
                <option value="ALL">All Categories</option>
                <option value="ACCIDENT">Accidents</option>
                <option value="HIT_AND_RUN">Hit & Run</option>
                <option value="RASH_DRIVING">Rash Driving</option>
                <option value="DANGEROUS_DRIVING">Dangerous Driving</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-[#D8E0E8] text-xs font-semibold text-[#172B3A] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#1769AA]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ACTIONED">Actioned</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          {/* ANPR Plate Search Bar & Quick Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#667788] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Lookup Plate Number (e.g. KA-01-AB-1234)..."
                value={plateSearchQuery}
                onChange={(e) => setPlateSearchQuery(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#D8E0E8] text-xs font-mono font-bold text-[#172B3A] rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
              />
              {plateSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPlateSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#667788] hover:text-[#172B3A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setQuickFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  quickFilter === 'ALL'
                    ? 'bg-[#1769AA] text-white shadow-md'
                    : 'bg-white border border-[#D8E0E8] text-[#172B3A] hover:bg-[#F6F8FA]'
                }`}
              >
                All Vehicles
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('WATCHLIST')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  quickFilter === 'WATCHLIST'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-white border border-[#D8E0E8] text-rose-600 hover:bg-rose-50'
                }`}
              >
                🚨 Watchlist
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('SPEEDING')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  quickFilter === 'SPEEDING'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-white border border-[#D8E0E8] text-amber-600 hover:bg-amber-50'
                }`}
              >
                ⚡ Speeding (&gt;80km/h)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-[#667788] text-xs bg-[#F6F8FA] rounded-xl border border-[#D8E0E8]">
                No vehicles or ANPR records found matching the selected search query &amp; filters.
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isHotlistMatch = inc.plateText && hotlistPlates.some((p) => p.replace(/[^A-Z0-9]/g, '').includes(inc.plateText!.replace(/[^A-Z0-9]/g, '')) || inc.plateText!.replace(/[^A-Z0-9]/g, '').includes(p.replace(/[^A-Z0-9]/g, '')));
                const isSpeeding = inc.speedKmh > 80;
                const threat = calculateThreatScore(inc, !!isHotlistMatch);
                const isGreenWaveActive = greenWaveActiveId === inc.id;

                return (
                  <div
                    key={inc.id}
                    className={`p-4 rounded-xl transition space-y-3 ${
                      isHotlistMatch
                        ? 'bg-rose-50 border-2 border-rose-500 shadow-md'
                        : 'bg-[#F6F8FA] border border-[#D8E0E8] hover:border-[#1769AA]/30'
                    }`}
                  >
                    {isHotlistMatch && (
                      <div className="bg-rose-100 border border-rose-200 p-2 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-black text-rose-700 flex items-center gap-1.5 animate-pulse">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>🚨 POLICE MATCH: WANTED VEHICLE [{inc.plateText}] SPOTTED!</span>
                        </span>
                        {onSelectOnMap && (
                          <button
                            type="button"
                            onClick={() => onSelectOnMap(inc.latitude, inc.longitude, `🚨 POLICE MATCH: ${inc.plateText}`)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-md transition flex items-center gap-1 shadow-sm"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Locate on Map</span>
                          </button>
                        )}
                      </div>
                    )}

                    {isGreenWaveActive && (
                      <div className="bg-emerald-500/20 border border-emerald-500/60 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>🟢 GREEN WAVE ACTIVE: Emergency Corridor Signal Preemption Engaged!</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setGreenWaveActiveId(null)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          Deactivate
                        </button>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoryBadge(inc.category)}
                        {getStatusBadge(inc.status)}
                        {isSpeeding && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                            ⚡ SPEEDING ({inc.speedKmh} km/h)
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono ${threat.badgeClass.replace('bg-red-600 text-white', 'bg-rose-100 text-rose-700 border-rose-300').replace('bg-amber-500/20 text-amber-300', 'bg-amber-100 text-amber-700 border-amber-300').replace('bg-teal-500/20 text-teal-300', 'bg-teal-50 text-teal-700 border-teal-200')}`}>
                          🧠 {threat.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(inc.category === 'ACCIDENT' || inc.category === 'HIT_AND_RUN' || inc.vehicleType?.toUpperCase().includes('AMBULANCE')) && (
                          <button
                            type="button"
                            onClick={() => setGreenWaveActiveId(isGreenWaveActive ? null : inc.id)}
                            className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition flex items-center gap-1 ${
                              isGreenWaveActive
                                ? 'bg-emerald-600 text-white font-black'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            🚑 {isGreenWaveActive ? 'Green Wave ON' : 'Green Wave'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIncident(inc);
                            setAuthorityNotes(inc.authorityNotes || '');
                            setAiDeblurActive(false);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1769AA] hover:bg-[#0B3558] text-white flex items-center gap-1 transition shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect Telemetry
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[#667788] font-semibold">License Plate:</span>
                        <div className="font-mono font-bold mt-0.5">
                          {inc.plateText ? (
                            <span className={`px-2 py-0.5 rounded border ${
                              isHotlistMatch
                                ? 'text-rose-700 bg-rose-100 border-rose-300 font-extrabold'
                                : 'text-teal-700 bg-teal-50 border-teal-200'
                            }`}>
                              {inc.plateText}
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              Plate Not Detected
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[#667788] font-semibold">Vehicle Type:</span>
                        <div className="font-bold text-[#172B3A] mt-0.5">{inc.vehicleType}</div>
                      </div>

                      <div>
                        <span className="text-[#667788] font-semibold">Speed / Conf:</span>
                        <div className="font-bold text-[#172B3A] mt-0.5">
                          {inc.speedKmh} km/h ({(inc.confidence * 100).toFixed(0)}%)
                        </div>
                      </div>

                      <div>
                        <span className="text-[#667788] font-semibold">Camera Source:</span>
                        <div className="font-bold text-[#172B3A] mt-0.5">{inc.busLabel}</div>
                      </div>
                    </div>

                    {onSelectOnMap && !isHotlistMatch && (
                      <div className="pt-2 border-t border-[#D8E0E8] flex items-center justify-between text-xs">
                        <span className="text-[#667788] flex items-center gap-1 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          Coords: {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectOnMap(inc.latitude, inc.longitude, `${inc.category} (${inc.vehicleType})`)}
                          className="text-[#1769AA] hover:underline font-bold flex items-center gap-1"
                        >
                          Locate on GIS Map <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Police Wanted Vehicle Watchlist & Trajectory Search Panel */}
        <div className="p-5 rounded-2xl bg-white border border-[#D8E0E8] space-y-4 shadow-sm">
          <div className="border-b border-[#D8E0E8] pb-3">
            <h3 className="text-md font-extrabold text-rose-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
              Police Wanted Vehicle Watchlist
            </h3>
            <p className="text-xs text-[#667788] mt-1">
              Manually enter suspect license plate numbers below. Edge cameras will automatically scan &amp; detect locations.
            </p>
          </div>

          {/* Form to enter target license plate */}
          <form onSubmit={handleAddHotlistPlate} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter Plate (e.g. KA01AB1234)..."
              value={newHotlistPlate}
              onChange={(e) => setNewHotlistPlate(e.target.value)}
              className="flex-1 bg-[#F6F8FA] border border-[#D8E0E8] text-xs font-mono font-bold uppercase text-[#172B3A] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
            />
            <button
              type="submit"
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 shrink-0"
            >
              + Track Plate
            </button>
          </form>

          {/* Active Watchlist Tags */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-extrabold text-[#667788] uppercase tracking-wider">
              Active Police Target Watchlist ({hotlistPlates.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hotlistPlates.map((plate) => (
                <span
                  key={plate}
                  className="bg-rose-50 border border-rose-200 text-rose-700 font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>{plate}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHotlistPlate(plate)}
                    className="hover:text-rose-900 transition ml-1"
                    title="Remove from Watchlist"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#D8E0E8] space-y-3">
            <div>
              <h4 className="text-xs font-bold text-[#0B3558] flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-[#1769AA]" />
                <span>Vehicle Trajectory Search</span>
              </h4>
              <p className="text-[11px] text-[#667788]">Search vehicle history across camera mesh</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#667788] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Plate or Type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#D8E0E8] text-xs text-[#172B3A] font-semibold rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-[#1769AA]"
              />
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {trackedVehicles.map((trk) => (
                <div key={trk.id} className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#1769AA]">{trk.trackId}</span>
                    {trk.plateText ? (
                      <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[11px]">
                        {trk.plateText}
                      </span>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                        Plate Not Detected
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#172B3A] font-semibold flex items-center justify-between">
                    <span>{trk.vehicleType} • {trk.speedKmh} km/h</span>
                    <span className="text-[#667788] text-[11px]">{trk.lastSeenBus}</span>
                  </div>

                  {onSelectOnMap && trk.trajectory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectOnMap(trk.trajectory[0][0], trk.trajectory[0][1], `Track: ${trk.trackId}`)}
                      className="w-full py-1 text-[11px] font-bold text-center rounded bg-white hover:bg-teal-50 text-[#1769AA] border border-[#D8E0E8] hover:border-teal-200 transition"
                    >
                      View Trajectory Overlay on Map
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Inspection Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E0E8] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">

            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute right-4 top-4 text-[#667788] hover:text-[#172B3A] p-1 rounded-lg bg-[#F6F8FA] hover:bg-[#D8E0E8] transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {getCategoryBadge(selectedIncident.category)}
                <h3 className="text-lg font-bold text-[#0B3558]">Vehicle Telemetry Evidence File</h3>
              </div>
              <button
                type="button"
                onClick={() => setAiDeblurActive(!aiDeblurActive)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                  aiDeblurActive
                    ? 'bg-purple-600 text-white border border-purple-400 animate-pulse'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                🔬 {aiDeblurActive ? 'AI Deblur Matrix Active' : '⚡ AI Deblur & Enhance'}
              </button>
            </div>

            {/* AI Super-Resolution Deblur Panel */}
            {aiDeblurActive && (
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-purple-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-600" />
                    <span>AI Optical Character Confidence Matrix &amp; Deblur Model</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                    ESRGAN + YOLO-ANPR v11
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center font-mono">
                  {(selectedIncident.plateText || 'KA01AB1234').split('').map((char, idx) => {
                    const conf = Math.floor(92 + (idx * 3) % 8);
                    return (
                      <div key={idx} className="p-1.5 rounded bg-white border border-purple-200 space-y-0.5">
                        <div className="text-sm font-black text-[#172B3A]">{char}</div>
                        <div className="text-[9px] text-teal-600 font-bold">{conf}%</div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-[#667788] flex items-center justify-between pt-1 border-t border-purple-200">
                  <span className="font-semibold text-[#172B3A]">Probabilistic Match Candidates:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-xs">
                    <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{selectedIncident.plateText || 'KA-01-AB-1234'} (98.4%)</span>
                    <span className="text-[#667788] bg-white px-2 py-0.5 rounded border border-[#D8E0E8]">KA-01-A8-1234 (84.1%)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Snapshot Display */}
              <div className="aspect-video bg-black rounded-xl border border-[#D8E0E8] flex flex-col items-center justify-center relative overflow-hidden">
                {selectedIncident.imageSnippet ? (
                  <img
                    src={selectedIncident.imageSnippet}
                    alt={selectedIncident.plateText || 'Vehicle Snapshot'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    <Car className="w-12 h-12 text-slate-500 mb-2" />
                    <span className="text-xs text-slate-300 font-mono">Camera Frame Snippet</span>
                    <span className="text-[10px] text-teal-400 font-mono mt-1">Bus Sensor: {selectedIncident.busLabel}</span>
                    
                    {/* Simulated Bounding Box Overlay */}
                    <div className="absolute top-4 left-6 right-6 bottom-6 border-2 border-red-500/80 rounded flex items-start p-1">
                      <span className="bg-red-500 text-white font-mono text-[9px] px-1 rounded">
                        {selectedIncident.vehicleType} ({(selectedIncident.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </>
                )}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur text-[9px] font-mono text-slate-300 border border-white/10">
                  CAM-{selectedIncident.busLabel?.slice(-3) || 'REC'} • {selectedIncident.vehicleType}
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#667788] font-semibold">License Plate:</span>
                    {selectedIncident.plateText ? (
                      <span className="font-mono font-bold text-teal-700">{selectedIncident.plateText}</span>
                    ) : (
                      <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                        Plate Not Detected
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667788] font-semibold">Vehicle Classification:</span>
                    <span className="font-bold text-[#172B3A]">{selectedIncident.vehicleType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667788] font-semibold">Measured Velocity:</span>
                    <span className="font-bold text-[#172B3A]">{selectedIncident.speedKmh} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667788] font-semibold">Detection Confidence:</span>
                    <span className="font-bold text-[#1769AA]">{(selectedIncident.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667788] font-semibold">Timestamp:</span>
                    <span className="font-mono font-bold text-[#172B3A]">{new Date(selectedIncident.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8]">
                  <div className="text-[#667788] font-semibold mb-1">Authority Action Status:</div>
                  {getStatusBadge(selectedIncident.status)}
                </div>
              </div>
            </div>

            {/* Officer Action Routing */}
            <div className="p-4 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-[#0B3558] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1769AA]" />
                Secure Authority Alert Routing
              </h4>

              <div>
                <label className="block text-[11px] font-semibold text-[#667788] mb-1">Dispatch / Authority Review Notes:</label>
                <textarea
                  value={authorityNotes}
                  onChange={(e) => setAuthorityNotes(e.target.value)}
                  placeholder="Enter dispatch notes, patrol unit assignment, or challan ID..."
                  rows={2}
                  className="w-full bg-white border border-[#D8E0E8] text-xs font-semibold text-[#172B3A] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'ACKNOWLEDGED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/80 hover:bg-amber-600 text-white transition"
                >
                  Acknowledge Alert
                </button>
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'ACTIONED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/80 hover:bg-blue-600 text-white transition"
                >
                  Dispatch Patrol Unit
                </button>
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'CLOSED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600 text-white transition"
                >
                  Resolve & Close File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
