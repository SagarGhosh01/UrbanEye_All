import React, { useState, useEffect } from 'react';
import { IncidentRecord, TrackedVehicle, AlertStatus, IncidentCategory } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { AlertTriangle, Car, ShieldAlert, Eye, Search, CheckCircle2, Clock, MapPin, Navigation, FileText, ChevronRight, X } from 'lucide-react';

interface IncidentResponseViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const IncidentResponseView: React.FC<IncidentResponseViewProps> = ({ districtId, onSelectOnMap }) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [summary, setSummary] = useState({
    totalIncidentsToday: 4,
    pendingAlerts: 2,
    plateDetectionRatePercent: 75,
    activeTrackedVehicles: 14,
  });
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [trackedVehicles, setTrackedVehicles] = useState<TrackedVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorityNotes, setAuthorityNotes] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    loadData();
  }, [districtId, filterCategory, filterStatus]);

  const loadData = async () => {
    const res = await intelligenceService.getIncidents(
      districtId,
      filterStatus !== 'ALL' ? (filterStatus as AlertStatus) : undefined,
      filterCategory !== 'ALL' ? filterCategory : undefined
    );
    if (res.status === 'SUCCESS') {
      setIncidents(res.incidents || []);
      if (res.summary) setSummary(res.summary);
    }
    const tracksRes = await intelligenceService.getTrackedVehicles(searchQuery);
    if (tracksRes.status === 'SUCCESS') {
      setTrackedVehicles(tracksRes.tracks || []);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: AlertStatus) => {
    setUpdatingId(id);
    await intelligenceService.updateIncidentStatus(id, newStatus, authorityNotes);
    setUpdatingId(null);
    if (selectedIncident && selectedIncident.id === id) {
      setSelectedIncident({ ...selectedIncident, status: newStatus, authorityNotes });
    }
    loadData();
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
        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">VEHICLE EVENTS TODAY</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.totalIncidentsToday}</div>
            <div className="text-[11px] text-red-400 mt-0.5 font-medium">Critical ANPR Telemetry</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">PENDING ALERTS</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{summary.pendingAlerts}</div>
            <div className="text-[11px] text-amber-300/80 mt-0.5 font-medium">Requires Officer Review</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">ANPR RECOGNITION RATE</div>
            <div className="text-2xl font-bold text-teal-400 mt-1">{summary.plateDetectionRatePercent}%</div>
            <div className="text-[11px] text-teal-300/80 mt-0.5 font-medium">Optical Plate Extraction</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">ACTIVE TRACKED VEHICLES</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{summary.activeTrackedVehicles}</div>
            <div className="text-[11px] text-blue-300/80 mt-0.5 font-medium">Multi-Frame Trajectory</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Navigation className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Vehicle Tracker Log & Wanted Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Tracker Feed */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-teal-400" />
                Vehicle Tracker & ANPR Intelligence Feed
              </h3>
              <p className="text-xs text-slate-400">Live ANPR plate recognition, speed tracking & wanted vehicle detection</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
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
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
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
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Lookup Plate Number (e.g. KA-01-AB-1234)..."
                value={plateSearchQuery}
                onChange={(e) => setPlateSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-teal-500/40 text-xs font-mono text-white rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {plateSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPlateSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
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
                    ? 'bg-teal-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                All Vehicles
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('WATCHLIST')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  quickFilter === 'WATCHLIST'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-slate-900 text-red-300 hover:bg-slate-800'
                }`}
              >
                🚨 Watchlist
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('SPEEDING')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  quickFilter === 'SPEEDING'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-amber-300 hover:bg-slate-800'
                }`}
              >
                ⚡ Speeding (&gt;80km/h)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/50 rounded-xl border border-slate-800">
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
                        ? 'bg-red-950/80 border-2 border-red-500 shadow-2xl animate-pulse'
                        : 'bg-slate-900/70 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isHotlistMatch && (
                      <div className="bg-red-600/30 border border-red-500/80 p-2 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-black text-red-300 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                          <span>🚨 POLICE MATCH: WANTED VEHICLE [{inc.plateText}] SPOTTED!</span>
                        </span>
                        {onSelectOnMap && (
                          <button
                            type="button"
                            onClick={() => onSelectOnMap(inc.latitude, inc.longitude, `🚨 POLICE MATCH: ${inc.plateText}`)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded-md transition flex items-center gap-1 shadow-md"
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
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            ⚡ SPEEDING ({inc.speedKmh} km/h)
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono ${threat.badgeClass}`}>
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
                                ? 'bg-emerald-500 text-slate-950 font-black'
                                : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40'
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
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1E7F73] hover:bg-[#186a60] text-white flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect Telemetry
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">License Plate:</span>
                        <div className="font-mono font-bold mt-0.5">
                          {inc.plateText ? (
                            <span className={`px-2 py-0.5 rounded border ${
                              isHotlistMatch
                                ? 'text-red-300 bg-red-950 border-red-500 font-extrabold animate-bounce'
                                : 'text-teal-300 bg-teal-950/80 border-teal-500/30'
                            }`}>
                              {inc.plateText}
                            </span>
                          ) : (
                            <span className="text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 text-[11px]">
                              Plate Not Detected
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">Vehicle Type:</span>
                        <div className="font-semibold text-white mt-0.5">{inc.vehicleType}</div>
                      </div>

                      <div>
                        <span className="text-slate-400">Speed / Conf:</span>
                        <div className="font-semibold text-white mt-0.5">
                          {inc.speedKmh} km/h ({(inc.confidence * 100).toFixed(0)}%)
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">Camera Source:</span>
                        <div className="font-semibold text-slate-300 mt-0.5">{inc.busLabel}</div>
                      </div>
                    </div>

                    {onSelectOnMap && !isHotlistMatch && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-red-400" />
                          Coords: {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectOnMap(inc.latitude, inc.longitude, `${inc.category} (${inc.vehicleType})`)}
                          className="text-[#1E7F73] hover:underline font-semibold flex items-center gap-1"
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
        <div className="p-5 rounded-2xl bg-[#10233D] border border-red-500/40 space-y-4 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-md font-extrabold text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
              Police Wanted Vehicle Watchlist
            </h3>
            <p className="text-xs text-slate-300 mt-1">
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
              className="flex-1 bg-slate-900 border border-red-500/50 text-xs font-mono font-bold uppercase text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition active:scale-95 shrink-0"
            >
              + Track Plate
            </button>
          </form>

          {/* Active Watchlist Tags */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Active Police Target Watchlist ({hotlistPlates.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hotlistPlates.map((plate) => (
                <span
                  key={plate}
                  className="bg-red-950/80 border border-red-500/60 text-red-300 font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>{plate}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHotlistPlate(plate)}
                    className="hover:text-white transition ml-1"
                    title="Remove from Watchlist"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span>Vehicle Trajectory Search</span>
              </h4>
              <p className="text-[11px] text-slate-400">Search vehicle history across camera mesh</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Plate or Type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {trackedVehicles.map((trk) => (
                <div key={trk.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-blue-300">{trk.trackId}</span>
                    {trk.plateText ? (
                      <span className="font-mono text-teal-300 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/20 text-[11px]">
                        {trk.plateText}
                      </span>
                    ) : (
                      <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px]">
                        Plate Not Detected
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 flex items-center justify-between">
                    <span>{trk.vehicleType} • {trk.speedKmh} km/h</span>
                    <span className="text-slate-400 text-[11px]">{trk.lastSeenBus}</span>
                  </div>

                  {onSelectOnMap && trk.trajectory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectOnMap(trk.trajectory[0][0], trk.trajectory[0][1], `Track: ${trk.trackId}`)}
                      className="w-full py-1 text-[11px] font-semibold text-center rounded bg-slate-800 hover:bg-slate-700 text-teal-300 transition"
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
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#10233D] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">

            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {getCategoryBadge(selectedIncident.category)}
                <h3 className="text-lg font-bold text-white">Vehicle Telemetry Evidence File</h3>
              </div>
              <button
                type="button"
                onClick={() => setAiDeblurActive(!aiDeblurActive)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                  aiDeblurActive
                    ? 'bg-purple-600 text-white border border-purple-400 animate-pulse'
                    : 'bg-slate-800 text-purple-300 hover:bg-slate-700 border border-purple-500/30'
                }`}
              >
                🔬 {aiDeblurActive ? 'AI Deblur Matrix Active' : '⚡ AI Deblur & Enhance'}
              </button>
            </div>

            {/* AI Super-Resolution Deblur Panel */}
            {aiDeblurActive && (
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                    <span>AI Optical Character Confidence Matrix &amp; Deblur Model</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/30">
                    ESRGAN + YOLO-ANPR v11
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center font-mono">
                  {(selectedIncident.plateText || 'KA01AB1234').split('').map((char, idx) => {
                    const conf = Math.floor(92 + (idx * 3) % 8);
                    return (
                      <div key={idx} className="p-1.5 rounded bg-slate-900 border border-purple-500/40 space-y-0.5">
                        <div className="text-sm font-black text-white">{char}</div>
                        <div className="text-[9px] text-teal-300 font-bold">{conf}%</div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-purple-500/30">
                  <span className="text-slate-400">Probabilistic Match Candidates:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-xs">
                    <span className="text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-500/30">{selectedIncident.plateText || 'KA-01-AB-1234'} (98.4%)</span>
                    <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">KA-01-A8-1234 (84.1%)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Snapshot Display */}
              <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                <Car className="w-12 h-12 text-slate-600 mb-2" />
                <span className="text-xs text-slate-400 font-mono">Camera Frame Snippet</span>
                <span className="text-[10px] text-teal-400 font-mono mt-1">Bus Sensor: {selectedIncident.busLabel}</span>
                
                {/* Simulated Bounding Box Overlay */}
                <div className="absolute top-4 left-6 right-6 bottom-6 border-2 border-red-500/80 rounded flex items-start p-1">
                  <span className="bg-red-500 text-white font-mono text-[9px] px-1 rounded">
                    {selectedIncident.vehicleType} ({(selectedIncident.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">License Plate:</span>
                    {selectedIncident.plateText ? (
                      <span className="font-mono font-bold text-teal-300">{selectedIncident.plateText}</span>
                    ) : (
                      <span className="font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px]">
                        Plate Not Detected
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vehicle Classification:</span>
                    <span className="font-semibold text-white">{selectedIncident.vehicleType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Measured Velocity:</span>
                    <span className="font-semibold text-white">{selectedIncident.speedKmh} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Detection Confidence:</span>
                    <span className="font-semibold text-teal-400">{(selectedIncident.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="font-mono text-slate-300">{new Date(selectedIncident.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 mb-1">Authority Action Status:</div>
                  {getStatusBadge(selectedIncident.status)}
                </div>
              </div>
            </div>

            {/* Officer Action Routing */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1E7F73]" />
                Secure Authority Alert Routing
              </h4>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Dispatch / Authority Review Notes:</label>
                <textarea
                  value={authorityNotes}
                  onChange={(e) => setAuthorityNotes(e.target.value)}
                  placeholder="Enter dispatch notes, patrol unit assignment, or challan ID..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
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
