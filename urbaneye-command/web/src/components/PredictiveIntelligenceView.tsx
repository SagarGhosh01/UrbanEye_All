import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CongestionForecastData, RecurringHotspot, UrbanRecommendation } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { getSocket } from '../services/socket';
import { Sparkles, TrendingUp, AlertCircle, Wrench, Navigation, CheckCircle2, ArrowRight, ShieldAlert, Clock, MapPin, Zap } from 'lucide-react';

interface PHIMetrics {
  pavementHealthIndex: number;
  phiState: string;
  decayForecastPct: number;
  subBaseCompaction: number;
  preventedLossLakhs: number;
}

interface PredictiveIntelligenceViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const PredictiveIntelligenceView: React.FC<PredictiveIntelligenceViewProps> = ({ districtId, onSelectOnMap }) => {
  const [forecast, setForecast] = useState<CongestionForecastData | null>(null);
  const [hotspots, setHotspots] = useState<RecurringHotspot[]>([]);
  const [recommendations, setRecommendations] = useState<UrbanRecommendation[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<'min15' | 'min30' | 'min60'>('min15');
  const [phi, setPhi] = useState<PHIMetrics>({
    pavementHealthIndex: 82.4,
    phiState: 'Good / Satisfactory',
    decayForecastPct: -14.2,
    subBaseCompaction: 88.6,
    preventedLossLakhs: 4.85,
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const loadData = useCallback(async () => {
    const forecastRes = await intelligenceService.getCongestionForecast(districtId);
    if (forecastRes.status === 'SUCCESS' && forecastRes.forecast) {
      setForecast(forecastRes.forecast);
      if (forecastRes.phi) {
        setPhi(forecastRes.phi);
      }
    }
    const hotspotsRes = await intelligenceService.getRecurringHotspots(districtId);
    if (hotspotsRes.status === 'SUCCESS') {
      setHotspots(hotspotsRes.hotspots || []);
    }
    const recsRes = await intelligenceService.getRecommendations(districtId);
    if (recsRes.status === 'SUCCESS') {
      setRecommendations(recsRes.recommendations || []);
    }
    setLastSyncTime(new Date().toLocaleTimeString());
  }, [districtId]);

  // Initial load + 5-second polling
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Socket.IO real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onForecastUpdate = (payload: any) => {
      if (payload.forecast) setForecast(payload.forecast);
      if (payload.phi) setPhi(payload.phi);
      setLastSyncTime(new Date().toLocaleTimeString());
    };

    const onRecDispatched = (payload: any) => {
      setRecommendations(prev =>
        prev.map(r => r.id === payload.id ? { ...r, status: 'DISPATCHED' as const } : r)
      );
    };

    socket.on('predictive:forecast_update', onForecastUpdate);
    socket.on('recommendation:dispatched', onRecDispatched);

    return () => {
      socket.off('predictive:forecast_update', onForecastUpdate);
      socket.off('recommendation:dispatched', onRecDispatched);
    };
  }, []);

  const handleExecuteRec = async (rec: UrbanRecommendation) => {
    setExecutingId(rec.id);
    const actionLabel = rec.type === 'WORK_ORDER' ? 'Municipal Work Order' : rec.type === 'TRAFFIC_REROUTE' ? 'Traffic Reroute Dispatch' : 'Safety Intervention';
    const res = await intelligenceService.executeRecommendation(rec.id, actionLabel);
    setExecutingId(null);
    if (res.status === 'SUCCESS') {
      setToastMessage(`✅ Created ${actionLabel}: ${rec.title}`);
      setTimeout(() => setToastMessage(null), 4000);
      loadData();
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">🔥 CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">⚠️ HIGH</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">ℹ️ MEDIUM</span>;
    }
  };

  const currentTF = forecast ? forecast[activeTimeframe] : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pavement Health Index (PHI) & 30-Day Degradation Forecasting Header */}
      <div className="p-6 rounded-lg bg-[#0B3558] border border-[#0B3558] space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded bg-[#1769AA] text-white shadow-sm text-[11px] font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span>Pavement Health Index Engine</span>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-white/10 text-white border border-white/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Live Telemetry
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
              <TrendingUp className="w-6 h-6 text-[#4DA8DA]" />
              15 / 30 / 60-Minute & 30-Day Infrastructure Forecasting
            </h3>
            <p className="text-sm text-blue-200 mt-1 font-medium">
              AI degradation decay modeling, sub-base structural scoring & bottleneck prediction {lastSyncTime ? `• Synced ${lastSyncTime}` : ''}
            </p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center p-1.5 rounded bg-[#102B40] border border-[#173D5C] text-sm shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTimeframe('min15')}
              className={`px-4 py-2 rounded font-bold transition-all duration-300 ${
                activeTimeframe === 'min15' ? 'bg-white text-[#0B3558] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              +15 Mins
            </button>
            <button
              type="button"
              onClick={() => setActiveTimeframe('min30')}
              className={`px-4 py-2 rounded font-bold transition-all duration-300 ${
                activeTimeframe === 'min30' ? 'bg-white text-[#0B3558] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              +30 Mins
            </button>
            <button
              type="button"
              onClick={() => setActiveTimeframe('min60')}
              className={`px-4 py-2 rounded font-bold transition-all duration-300 ${
                activeTimeframe === 'min60' ? 'bg-white text-[#0B3558] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              +60 Mins
            </button>
          </div>
        </div>

        {/* Pavement Health Index Metric Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-white p-4 rounded-lg border border-[#D8E0E8] border-l-4 border-l-teal-600 shadow hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div>
              <div className="text-[10px] font-bold text-[#667788] uppercase tracking-wider mb-1">Pavement Health Index</div>
              <div className="text-3xl font-black text-[#0B3558]">{phi.pavementHealthIndex} <span className="text-sm font-bold text-[#667788]">/ 100</span></div>
              <div className="text-xs text-teal-700 font-bold mt-1">State: {phi.phiState}</div>
            </div>
            <div className="w-12 h-12 rounded bg-teal-50 text-teal-700 flex items-center justify-center font-black text-sm border border-teal-200 shadow-inner group-hover:scale-110 transition-transform">
              PHI
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#D8E0E8] border-l-4 border-l-amber-600 shadow hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div>
              <div className="text-[10px] font-bold text-[#667788] uppercase tracking-wider mb-1">30-Day Decay Forecast</div>
              <div className="text-3xl font-black text-amber-700">{phi.decayForecastPct}% <span className="text-sm font-bold text-[#667788]">drop</span></div>
              <div className="text-xs text-amber-700 font-bold mt-1">If unrepaired by Day 30</div>
            </div>
            <div className="w-12 h-12 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xl border border-amber-200 shadow-inner group-hover:scale-110 transition-transform">
              📉
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#D8E0E8] border-l-4 border-l-[#1769AA] shadow hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div>
              <div className="text-[10px] font-bold text-[#667788] uppercase tracking-wider mb-1">Sub-base Compaction</div>
              <div className="text-3xl font-black text-[#1769AA]">{phi.subBaseCompaction}%</div>
              <div className="text-xs text-[#1769AA] font-bold mt-1">Structural Base Infill</div>
            </div>
            <div className="w-12 h-12 rounded bg-blue-50 text-[#1769AA] flex items-center justify-center font-black text-xl border border-blue-200 shadow-inner group-hover:scale-110 transition-transform">
              🏗️
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#D8E0E8] border-l-4 border-l-emerald-600 shadow hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div>
              <div className="text-[10px] font-bold text-[#667788] uppercase tracking-wider mb-1">Prevented Loss</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">₹{phi.preventedLossLakhs} L</div>
              <div className="text-xs text-emerald-700 font-bold mt-1.5">Early PWD Interventions</div>
            </div>
            <div className="w-12 h-12 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl border border-emerald-200 shadow-inner group-hover:scale-110 transition-transform">
              💰
            </div>
          </div>
        </div>

        {currentTF && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#173D5C]">
            <div className="p-6 rounded-lg bg-white border border-[#D8E0E8] flex items-center justify-between shadow hover:shadow-md transition-shadow group">
              <div>
                <div className="text-sm font-bold text-[#667788] uppercase tracking-wide">Forecasted Density</div>
                <div className="text-4xl font-black text-[#0B3558] mt-2">{currentTF.predictedDensityPercent}%</div>
                <div className="text-xs px-2.5 py-1 inline-block bg-teal-50 text-teal-800 border border-teal-200 rounded font-bold mt-2">
                  {currentTF.trafficLevel} Traffic State
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-[5px] border-[#1769AA] flex items-center justify-center font-black text-lg text-[#0B3558] bg-[#F6F8FA] shadow-inner group-hover:scale-110 transition-transform duration-300">
                {currentTF.predictedDensityPercent}%
              </div>
            </div>

            <div className="md:col-span-2 p-5 rounded-lg bg-white border border-[#D8E0E8] space-y-3 shadow hover:shadow-md transition-shadow">
              <div className="text-sm font-black text-[#0B3558] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1769AA]" />
                Predicted Bottleneck Locations:
              </div>
              <div className="space-y-2">
                {currentTF.predictedBottlenecks.map((btn, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-3 rounded bg-[#F6F8FA] border border-[#D8E0E8] hover:bg-white hover:border-[#1769AA] transition-colors">
                    <span className="font-bold text-[#0B3558]">{btn.location}</span>
                    <div className="flex items-center gap-4">
                      <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs font-bold border border-amber-200 shadow-sm">+{btn.expectedDelayMin} min delay</span>
                      <span className="text-[#1769AA] font-mono text-xs font-bold bg-white px-2 py-1 rounded shadow-sm border border-[#D8E0E8]">Conf: {(btn.confidence * 100).toFixed(0)}%</span>
                      {onSelectOnMap && (
                        <button
                          type="button"
                          onClick={() => onSelectOnMap(btn.lat, btn.lon, btn.location)}
                          className="px-3 py-1 bg-[#1769AA] hover:bg-[#0B3558] text-white rounded text-xs font-bold shadow-sm transition-colors"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Recurring Hotspots & AI SRIMS Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Defect Hotspots */}
        <div className="p-6 rounded-lg bg-white border border-[#D8E0E8] space-y-5 shadow hover:shadow-md transition-shadow">
          <div className="pb-3 border-b border-[#D8E0E8]">
            <h3 className="text-lg font-black text-[#0B3558] flex items-center gap-2 tracking-tight uppercase">
              <Wrench className="w-5 h-5 text-[#1769AA]" />
              Recurring Defect Hotspots & Priority
            </h3>
            <p className="text-sm text-[#667788] mt-1 font-medium">High-frequency damage sites prioritized for capital PWD overlay</p>
          </div>

          <div className="space-y-4">
            {hotspots.map((hs) => (
              <div key={hs.id} className="p-5 rounded-lg bg-[#F6F8FA] border border-[#D8E0E8] border-l-4 border-l-amber-600 space-y-3 hover:shadow transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-black text-[#0B3558] leading-tight">{hs.locationName}</h4>
                  <span className="px-3 py-1 rounded bg-amber-600 text-white text-xs font-bold shadow-sm">
                    Priority: {hs.maintenancePriority.toFixed(0)} / 100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm border-y border-[#D8E0E8] py-3">
                  <div className="flex flex-col">
                    <span className="text-[#667788] text-xs font-bold uppercase tracking-wider mb-0.5">30-Day Detections</span>
                    <span className="font-black text-[#0B3558] text-lg">{hs.recurrenceCount} <span className="text-xs font-semibold text-[#667788]">times</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#667788] text-xs font-bold uppercase tracking-wider mb-0.5">Defect Type</span>
                    <span className="font-black text-amber-700 text-lg">{hs.primaryDefectType.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="p-3 rounded bg-white text-xs font-medium text-[#172B3A] border border-[#D8E0E8] shadow-sm flex gap-2 items-start">
                  <div className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200 mt-0.5"><Wrench className="w-3 h-3" /></div>
                  <div>
                    <span className="font-bold text-[#0B3558] block mb-0.5">Recommended Intervention:</span>
                    {hs.recommendedAction}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations Engine */}
        <div className="p-6 rounded-lg bg-[#0B3558] border border-[#0B3558] space-y-5 shadow hover:shadow-md transition-shadow text-white">
          <div className="pb-3 border-b border-[#173D5C]">
            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tight uppercase">
              <Sparkles className="w-5 h-5 text-[#4DA8DA]" />
              AI SRIMS Recommendations Engine
            </h3>
            <p className="text-sm text-blue-200 mt-1 font-medium">Autonomous actionable work-order & traffic dispatch suggestions</p>
          </div>

          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-5 rounded bg-white text-[#172B3A] border border-[#D8E0E8] space-y-4 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-base font-black text-[#0B3558] leading-tight">{rec.title}</h4>
                  <div className="shrink-0 mt-0.5">{getUrgencyBadge(rec.urgency)}</div>
                </div>

                <p className="text-sm text-[#4A5568] leading-relaxed font-medium">{rec.description}</p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#D8E0E8]">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#F6F8FA] px-2.5 py-1 rounded border border-[#D8E0E8] text-xs flex flex-col">
                      <span className="text-[9px] text-[#667788] font-bold uppercase tracking-wider">Impact Score</span>
                      <span className="font-black text-[#1769AA]">{rec.impactScore}</span>
                    </span>
                    {rec.estimatedCostINR && (
                      <span className="bg-[#F6F8FA] px-2.5 py-1 rounded border border-[#D8E0E8] text-xs flex flex-col">
                        <span className="text-[9px] text-[#667788] font-bold uppercase tracking-wider">Est. Cost</span>
                        <span className="font-black text-emerald-700">₹{rec.estimatedCostINR.toLocaleString('en-IN')}</span>
                      </span>
                    )}
                  </div>

                  {rec.status === 'DISPATCHED' ? (
                    <span className="px-4 py-2 rounded text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="w-4 h-4" /> Dispatched
                    </span>
                  ) : (
                    <button
                      disabled={executingId === rec.id}
                      onClick={() => handleExecuteRec(rec)}
                      className="px-4 py-2 rounded text-xs font-black bg-[#1769AA] hover:bg-[#0B3558] text-white flex items-center justify-center gap-2 shadow transition-all active:scale-95 disabled:opacity-70"
                    >
                      {executingId === rec.id ? (
                        <Zap className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 text-white" />
                      )}
                      {rec.type === 'WORK_ORDER' ? 'Create Work Order' : 'Deploy Action'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
