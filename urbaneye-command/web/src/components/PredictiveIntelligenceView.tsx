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
      <div className="p-5 rounded-2xl bg-white border border-[#D8E0E8] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-xs font-mono font-bold uppercase">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Pavement Health Index (PHI) Engine</span>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#172B3A] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              15 / 30 / 60-Minute & 30-Day Infrastructure Decay Forecasting
            </h3>
            <p className="text-xs text-[#667788]">
              AI degradation decay modeling, sub-base structural scoring & bottleneck prediction {lastSyncTime ? `• Synced ${lastSyncTime}` : ''}
            </p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center p-1 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] text-xs">
            <button
              type="button"
              onClick={() => setActiveTimeframe('min15')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min15' ? 'bg-[#1769AA] text-white shadow-sm' : 'text-[#667788] hover:text-[#172B3A]'
              }`}
            >
              +15 Mins
            </button>
            <button
              type="button"
              onClick={() => setActiveTimeframe('min30')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min30' ? 'bg-[#1769AA] text-white shadow-sm' : 'text-[#667788] hover:text-[#172B3A]'
              }`}
            >
              +30 Mins
            </button>
            <button
              type="button"
              onClick={() => setActiveTimeframe('min60')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min60' ? 'bg-[#1769AA] text-white shadow-sm' : 'text-[#667788] hover:text-[#172B3A]'
              }`}
            >
              +60 Mins
            </button>
          </div>
        </div>

        {/* Pavement Health Index Metric Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[#F6F8FA] p-3.5 rounded-xl border border-[#D8E0E8] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider">Pavement Health Index</div>
              <div className="text-2xl font-black text-teal-700 mt-0.5">{phi.pavementHealthIndex} <span className="text-xs font-normal text-[#667788]">/ 100</span></div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">State: {phi.phiState}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs border border-teal-200">
              PHI
            </div>
          </div>

          <div className="bg-[#F6F8FA] p-3.5 rounded-xl border border-[#D8E0E8] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-[#667788] uppercase tracking-wider">30-Day Decay Forecast</div>
              <div className="text-2xl font-black text-amber-600 mt-0.5">{phi.decayForecastPct}% <span className="text-xs font-normal text-[#667788]">drop</span></div>
              <div className="text-[10px] text-amber-600 font-semibold mt-0.5">If unrepaired by Day 30</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-200">
              📉
            </div>
          </div>

          <div className="bg-[#F6F8FA] p-3.5 rounded-xl border border-[#D8E0E8] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-[#667788] uppercase tracking-wider">Sub-base Compaction</div>
              <div className="text-2xl font-black text-blue-600 mt-0.5">{phi.subBaseCompaction}%</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Structural Base Infill</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
              🏗️
            </div>
          </div>

          <div className="bg-[#F6F8FA] p-3.5 rounded-xl border border-[#D8E0E8] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-[#667788] uppercase tracking-wider">Prevented Loss</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">₹{phi.preventedLossLakhs} Lakhs</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Early PWD Interventions</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-200">
              💰
            </div>
          </div>
        </div>

        {currentTF && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-white border border-[#D8E0E8] flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs text-[#667788]">Forecasted Density</div>
                <div className="text-2xl font-bold text-[#172B3A] mt-1">{currentTF.predictedDensityPercent}%</div>
                <div className="text-[11px] text-teal-600 font-semibold mt-0.5">{currentTF.trafficLevel} Traffic State</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-teal-200 flex items-center justify-center font-bold text-xs text-teal-700 bg-teal-50">
                {currentTF.predictedDensityPercent}%
              </div>
            </div>

            <div className="md:col-span-2 p-4 rounded-xl bg-white border border-[#D8E0E8] space-y-2 shadow-sm">
              <div className="text-xs font-bold text-[#172B3A]">Predicted Bottleneck Locations:</div>
              <div className="space-y-1.5">
                {currentTF.predictedBottlenecks.map((btn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#F6F8FA] border border-[#D8E0E8]">
                    <span className="font-semibold text-[#172B3A]">{btn.location}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-600 font-semibold">+{btn.expectedDelayMin} min delay</span>
                      <span className="text-teal-600 font-mono text-[11px]">Conf: {(btn.confidence * 100).toFixed(0)}%</span>
                      {onSelectOnMap && (
                        <button
                          type="button"
                          onClick={() => onSelectOnMap(btn.lat, btn.lon, btn.location)}
                          className="text-xs text-[#1769AA] hover:underline font-bold"
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
        <div className="p-5 rounded-2xl bg-white border border-[#D8E0E8] space-y-4 shadow-sm">
          <div>
            <h3 className="text-md font-bold text-[#172B3A] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              Recurring Defect Hotspots & Priority Scoring
            </h3>
            <p className="text-xs text-[#667788]">High-frequency damage sites prioritized for capital PWD overlay</p>
          </div>

          <div className="space-y-3">
            {hotspots.map((hs) => (
              <div key={hs.id} className="p-4 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#172B3A] leading-tight">{hs.locationName}</h4>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                    Priority: {hs.maintenancePriority.toFixed(0)} / 100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#667788]">30-Day Detections:</span>
                    <span className="font-bold text-[#172B3A] ml-1.5">{hs.recurrenceCount} times</span>
                  </div>
                  <div>
                    <span className="text-[#667788]">Defect Type:</span>
                    <span className="font-bold text-teal-600 ml-1.5">{hs.primaryDefectType}</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white text-xs text-[#172B3A] border border-[#D8E0E8] shadow-sm">
                  <span className="font-bold text-amber-600">Recommended Intervention: </span>
                  {hs.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations Engine */}
        <div className="p-5 rounded-2xl bg-white border border-[#D8E0E8] space-y-4 shadow-sm">
          <div>
            <h3 className="text-md font-bold text-[#172B3A] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              AI SRIMS Recommendations Engine
            </h3>
            <p className="text-xs text-[#667788]">Autonomous actionable work-order & traffic dispatch suggestions</p>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl bg-[#F6F8FA] border border-[#D8E0E8] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#172B3A] leading-tight">{rec.title}</h4>
                  {getUrgencyBadge(rec.urgency)}
                </div>

                <p className="text-xs text-[#667788] leading-relaxed">{rec.description}</p>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#D8E0E8]">
                  <span className="text-[#667788] font-mono">
                    Impact: <strong className="text-teal-600">{rec.impactScore}</strong>
                    {rec.estimatedCostINR ? ` • Est. ₹${rec.estimatedCostINR.toLocaleString('en-IN')}` : ''}
                  </span>

                  {rec.status === 'DISPATCHED' ? (
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                    </span>
                  ) : (
                    <button
                      disabled={executingId === rec.id}
                      onClick={() => handleExecuteRec(rec)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#1769AA] hover:bg-[#104a7a] text-white flex items-center gap-1.5 shadow-sm transition active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
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
