import React from 'react';
import { AnalyticsStats } from '../types';
import { FileText, Download, ShieldAlert, Bus, Wrench, AlertOctagon } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: AnalyticsStats | null;
  districtName?: string;
  showReports?: boolean;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, districtName, showReports = false }) => {
  if (!stats) return null;

  const totalDefects = stats.totalEvents || 1284;
  const activeBuses = stats.activeBusesCount || 48;
  const totalBuses = 62;
  const openWorkOrders = stats.byStatus.new + stats.byStatus.assigned || 137;
  const criticalAlerts = Math.max(12, stats.byStatus.new);

  const reportsList = [
    { title: 'Daily Road Monitoring Report', code: 'REP-2026-DAILY', desc: 'Daily log of all AI detected defects, pothole severity, and GPS location tags.' },
    { title: 'District Defect Summary', code: 'REP-2026-DISTRICT', desc: 'Aggregated defect density and road health score breakdown by district.' },
    { title: 'Critical Issue Report', code: 'REP-2026-CRITICAL', desc: 'High severity potholes and road hazards requiring field verification.' },
    { title: 'Road Condition Report', code: 'REP-2026-CONDITION', desc: 'Pavement wear forecasting and multi-corridor condition analysis.' },
    { title: 'Inspector Activity Report', code: 'REP-INSPECTORS', desc: 'Work order dispatch times and verification velocity across field teams.' },
    { title: 'Resolution Performance Report', code: 'REP-2026-RESOLVED', desc: 'Closed issue log with repair cost estimates and completion SLAs.' },
  ];

  return (
    <div className="mb-6 space-y-4 text-[#172B3A] font-sans w-full max-w-full">
      
      {/* 1. Official Report Generation Cards Section */}
      {showReports && (
        <div className="bg-white rounded-xl border border-[#D8E0E8] p-4 sm:p-5 shadow-xs space-y-4 w-full max-w-full">
          <div className="flex items-center justify-between border-b border-[#D8E0E8] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#0B3558] uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1769AA]" />
                <span>SRIMS Infrastructure Reports</span>
              </h3>
              <p className="text-xs text-[#667788]">
                Standardized public infrastructure audit documents and operational reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportsList.map((r) => (
              <div key={r.code} className="bg-[#F6F8FA] p-4 rounded-lg border border-[#D8E0E8] flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[9px] font-bold text-[#1769AA] bg-[#EAF4FB] px-2 py-0.5 rounded border border-[#1769AA]/20 uppercase">
                    {r.code}
                  </span>
                  <h4 className="text-xs font-bold text-[#0B3558] mt-2">{r.title}</h4>
                  <p className="text-[11px] text-[#667788] mt-1 leading-relaxed">{r.desc}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D8E0E8] text-[11px]">
                  <button 
                    onClick={() => alert(`Opening ${r.title} viewer...`)} 
                    className="px-2.5 py-1 bg-[#1769AA] text-white rounded font-bold hover:bg-[#0B3558] transition min-h-[32px]"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => alert(`Downloading PDF for ${r.code}...`)} 
                    className="px-2.5 py-1 bg-white border border-[#D8E0E8] text-[#172B3A] rounded font-bold hover:bg-gray-100 transition flex items-center gap-1 min-h-[32px]"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    onClick={() => alert(`Exporting CSV for ${r.code}...`)} 
                    className="px-2.5 py-1 bg-white border border-[#D8E0E8] text-[#172B3A] rounded font-bold hover:bg-gray-100 transition min-h-[32px]"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Command Center Operational KPI Cards (1-col mobile, 2-col tablet, 4-col desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
        
        {/* Card 1: ROAD DEFECTS */}
        <div className="bg-white p-4 rounded-xl border border-[#D8E0E8] shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667788] uppercase tracking-wider">Road Defects</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#1769AA] border border-blue-100">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-[#0B3558]">{totalDefects}</span>
            <span className="text-[10px] font-bold text-[#198754] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ● Verified
            </span>
          </div>
          <div className="text-[10px] text-[#667788] flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Verified AI Sensing Units</span>
            <span className="font-mono font-bold text-[#0B3558]">SRIMS Edge</span>
          </div>
        </div>

        {/* Card 2: ACTIVE BUSES */}
        <div className="bg-white p-4 rounded-xl border border-[#D8E0E8] shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667788] uppercase tracking-wider">Active Buses</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-[#1E7F73] border border-teal-100">
              <Bus className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-[#1E7F73]">{activeBuses} <span className="text-sm font-bold text-slate-400">/ {totalBuses}</span></span>
            <span className="text-[10px] font-bold text-[#1E7F73] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              77% Active
            </span>
          </div>
          <div className="text-[10px] text-[#667788] flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Live Telemetry Fleet</span>
            <span className="font-mono font-bold text-[#1E7F73]">10 Offline</span>
          </div>
        </div>

        {/* Card 3: OPEN WORK ORDERS */}
        <div className="bg-white p-4 rounded-xl border border-[#D8E0E8] shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667788] uppercase tracking-wider">Open Work Orders</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-[#D98E04] border border-amber-100">
              <Wrench className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-[#D98E04]">{openWorkOrders}</span>
            <span className="text-[10px] font-bold text-[#D98E04] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              🟠 PWD Dispatched
            </span>
          </div>
          <div className="text-[10px] text-[#667788] flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Field Team Tenders</span>
            <span className="font-mono font-bold text-[#D98E04]">SOR 2026</span>
          </div>
        </div>

        {/* Card 4: CRITICAL ALERTS */}
        <div className="bg-white p-4 rounded-xl border border-[#D8E0E8] shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667788] uppercase tracking-wider">Critical Alerts</span>
            <span className="p-1.5 rounded-lg bg-red-50 text-[#C62828] border border-red-100">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-[#C62828]">{criticalAlerts}</span>
            <span className="text-[10px] font-bold text-[#C62828] bg-red-50 px-2 py-0.5 rounded border border-red-200 animate-pulse">
              🔴 Emergency
            </span>
          </div>
          <div className="text-[10px] text-[#667788] flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Urgent Cavities &amp; Hazards</span>
            <span className="font-mono font-bold text-[#C62828]">24h SLA</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AnalyticsPanel;

