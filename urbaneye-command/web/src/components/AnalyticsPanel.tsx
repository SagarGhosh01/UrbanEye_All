import React from 'react';
import { AnalyticsStats } from '../types';
import { FileText, Download } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: AnalyticsStats | null;
  districtName?: string;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, districtName }) => {
  if (!stats) return null;

  const reportsList = [
    { title: 'Daily Road Monitoring Report', code: 'REP-2026-DAILY', desc: 'Daily log of all AI detected defects, pothole severity, and GPS location tags.' },
    { title: 'District Defect Summary', code: 'REP-2026-DISTRICT', desc: 'Aggregated defect density and road health score breakdown by district.' },
    { title: 'Critical Issue Report', code: 'REP-2026-CRITICAL', desc: 'High severity potholes and road hazards requiring field verification.' },
    { title: 'Road Condition Report', code: 'REP-2026-[#0B3558]', desc: 'Pavement wear forecasting and multi-corridor condition analysis.' },
    { title: 'Inspector Activity Report', code: 'REP-[#1769AA]-INSPECTORS', desc: 'Work order dispatch times and verification velocity across field teams.' },
    { title: 'Resolution Performance Report', code: 'REP-2026-RESOLVED', desc: 'Closed issue log with repair cost estimates and completion SLAs.' },
  ];

  return (
    <div className="space-y-6 text-[#172B3A] font-sans">
      
      {/* 1. Official Report Generation Cards Section */}
      <div className="bg-white rounded border border-[#D8E0E8] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8E0E8] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0B3558] uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1769AA]" />
              <span>UrbanEye Infrastructure Reports</span>
            </h3>
            <p className="text-xs text-[#667788]">
              Standardized public infrastructure audit documents and operational reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportsList.map((r) => (
            <div key={r.code} className="bg-[#F6F8FA] p-4 rounded border border-[#D8E0E8] flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[9px] font-bold text-[#1769AA] bg-[#EAF4FB] px-2 py-0.5 rounded border border-[#1769AA]/20 uppercase">
                  {r.code}
                </span>
                <h4 className="text-xs font-bold text-[#0B3558] mt-2">{r.title}</h4>
                <p className="text-[11px] text-[#667788] mt-1 leading-relaxed">{r.desc}</p>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-[#D8E0E8] text-[11px]">
                <button 
                  onClick={() => alert(`Opening ${r.title} viewer...`)} 
                  className="px-2.5 py-1 bg-[#1769AA] text-white rounded font-bold hover:bg-[#0B3558] transition"
                >
                  View
                </button>
                <button 
                  onClick={() => alert(`Downloading PDF for ${r.code}...`)} 
                  className="px-2.5 py-1 bg-white border border-[#D8E0E8] text-[#172B3A] rounded font-bold hover:bg-gray-100 transition flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button 
                  onClick={() => alert(`Exporting CSV for ${r.code}...`)} 
                  className="px-2.5 py-1 bg-white border border-[#D8E0E8] text-[#172B3A] rounded font-bold hover:bg-gray-100 transition"
                >
                  Export CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Professional Restrained Blue Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded border border-[#D8E0E8] shadow-xs">
          <div className="text-xs font-bold text-[#667788] uppercase tracking-wider mb-1">
            Total Defects Detected
          </div>
          <div className="text-3xl font-black text-[#0B3558]">
            {stats.totalEvents}
          </div>
          <div className="text-[10px] text-[#667788] mt-1">Verified by AI Sensing Units</div>
        </div>

        <div className="bg-white p-4 rounded border border-[#D8E0E8] shadow-xs">
          <div className="text-xs font-bold text-[#667788] uppercase tracking-wider mb-1">
            Pending Work Orders
          </div>
          <div className="text-3xl font-black text-[#C62828]">
            {stats.byStatus.new}
          </div>
          <div className="text-[10px] text-[#667788] mt-1">Requires Inspector Verification</div>
        </div>

        <div className="bg-white p-4 rounded border border-[#D8E0E8] shadow-xs">
          <div className="text-xs font-bold text-[#667788] uppercase tracking-wider mb-1">
            Assigned for Repair
          </div>
          <div className="text-3xl font-black text-[#D98E04]">
            {stats.byStatus.assigned}
          </div>
          <div className="text-[10px] text-[#667788] mt-1">Dispatched to Field Maintenance Teams</div>
        </div>

        <div className="bg-white p-4 rounded border border-[#D8E0E8] shadow-xs">
          <div className="text-xs font-bold text-[#667788] uppercase tracking-wider mb-1">
            Resolved &amp; Verified
          </div>
          <div className="text-3xl font-black text-[#198754]">
            {stats.byStatus.resolved}
          </div>
          <div className="text-[10px] text-[#667788] mt-1">Pavement Integrity Restored</div>
        </div>

      </div>

    </div>
  );
};

export default AnalyticsPanel;
