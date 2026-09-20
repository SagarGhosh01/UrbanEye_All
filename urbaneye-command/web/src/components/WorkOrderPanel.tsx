import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Truck, CheckCircle, Clock, AlertCircle, RefreshCw, Sparkles, MapPin, Eye, FileText, CheckCircle2 } from 'lucide-react';

interface WorkOrder {
  id: string;
  type: string;
  title: string;
  description: string;
  urgency: string;
  impactScore: number;
  estimatedCostINR: number | null;
  status: string;
  createdAt: string;
}

interface Props {
  activeDistrictId: string | null;
}

export const WorkOrderPanel: React.FC<Props> = ({ activeDistrictId }) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = activeDistrictId && activeDistrictId !== 'ALL' ? `?districtId=${activeDistrictId}` : '';
      const res = await api.get(`/workorders${q}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch work orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDistrictId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/workorders/generate', { districtId: activeDistrictId === 'ALL' ? null : activeDistrictId });
      alert(res.data.message);
      fetchOrders();
    } catch (err) {
      alert('Failed to generate work orders.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      await api.patch(`/workorders/${id}/dispatch`);
      fetchOrders();
    } catch (err) {
      alert('Failed to dispatch order.');
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null) return '₹35,000';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const WORKFLOW_STEPS = [
    'AI DETECTION',
    'VERIFICATION',
    'SEVERITY ASSESSMENT',
    'WORK ORDER CREATED',
    'FIELD TEAM ASSIGNED',
    'REPAIR IN PROGRESS',
    'INSPECTION',
    'RESOLVED',
  ];

  return (
    <div className="bg-white border border-[#D8E0E8] rounded-xl flex flex-col h-full overflow-hidden shadow-xs w-full max-w-full">
      {/* Header */}
      <div className="bg-[#0B3558] px-4 py-3 flex flex-wrap items-center justify-between shrink-0 gap-2">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#90CAF9]" />
          PWD / NHAI Municipal Work Order Command System
        </h3>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 bg-[#1769AA] hover:bg-blue-600 text-white rounded text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 min-h-[36px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          Auto-Generate Work Orders
        </button>
      </div>

      <div className="p-4 bg-[#F6F8FA] border-b border-[#D8E0E8] space-y-4">
        {/* End-to-End Operational Workflow Diagram */}
        <div className="bg-[#08243D] text-white p-3 rounded-xl border border-blue-900/60 font-mono text-xs overflow-x-auto">
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>OPERATIONAL WORKFLOW STAGES</span>
          </div>
          <div className="flex items-center space-x-1.5 whitespace-nowrap overflow-x-auto text-[10px] pb-1 scrollbar-none">
            {WORKFLOW_STEPS.map((step, idx) => (
              <React.Fragment key={step}>
                {idx > 0 && <span className="text-blue-400 font-bold">→</span>}
                <span className={`px-2 py-1 rounded font-bold ${idx === 4 ? 'bg-[#1769AA] text-white border border-blue-400' : 'bg-blue-950 text-slate-300 border border-blue-900'}`}>
                  {step}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Dashboard Status Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-[#D8E0E8]">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">OPEN</span>
            <strong className="text-base text-[#0B3558] font-black">137</strong>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D8E0E8]">
            <span className="text-[10px] font-bold text-amber-600 block uppercase">ASSIGNED</span>
            <strong className="text-base text-[#D98E04] font-black">62</strong>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D8E0E8]">
            <span className="text-[10px] font-bold text-blue-600 block uppercase">IN PROGRESS</span>
            <strong className="text-base text-[#1769AA] font-black">31</strong>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D8E0E8]">
            <span className="text-[10px] font-bold text-indigo-600 block uppercase">INSPECTION</span>
            <strong className="text-base text-indigo-700 font-black">18</strong>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D8E0E8] col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase">RESOLVED</span>
            <strong className="text-base text-[#198754] font-black">426</strong>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F6F8FA]">
        {loading && <div className="text-center text-[#667788] text-xs py-4">Loading work orders from database...</div>}
        
        {!loading && orders.length === 0 && (
          <div className="text-center text-[#667788] text-xs py-8">
            No work orders found. Click "Auto-Generate" to create work orders for critical defects.
          </div>
        )}

        {orders.map((order, idx) => (
          <div key={order.id} className="bg-white border border-[#D8E0E8] p-3.5 rounded-xl shadow-xs flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-[#1769AA] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    WO-2026-0012{idx + 10}
                  </span>
                  <span className="font-bold text-[#172B3A] text-sm">{order.title}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  order.status === 'PROPOSED' ? 'bg-amber-50 border-amber-200 text-[#D98E04]' : 'bg-emerald-50 border-emerald-200 text-[#198754]'
                }`}>
                  {order.status === 'PROPOSED' ? '🟠 PWD PROPOSED' : '🟢 DISPATCHED TO CREW'}
                </span>
              </div>

              <p className="text-xs text-[#667788] leading-relaxed">{order.description}</p>
              
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="text-[10px] font-mono font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Score: {order.impactScore}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#198754] flex items-center gap-1">
                  Tender Budget: {formatCurrency(order.estimatedCostINR)}
                </span>
                <span className="text-[10px] font-mono text-[#667788] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
                <span className="text-[10px] font-bold text-[#0B3558] bg-slate-100 px-2 py-0.5 rounded">
                  Assigned: PWD Division Unit 4
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap md:flex-col justify-end items-end gap-2 border-t md:border-t-0 md:border-l border-[#D8E0E8] pt-3 md:pt-0 md:pl-4">
              <button
                onClick={() => alert(`Showing evidence for ${order.id}...`)}
                className="flex-1 md:flex-initial px-3 py-1.5 bg-white border border-[#D8E0E8] text-[#172B3A] rounded text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1 min-h-[36px]"
              >
                <Eye className="w-3.5 h-3.5 text-[#1769AA]" /> View Evidence
              </button>
              
              {order.status === 'PROPOSED' ? (
                <button
                  onClick={() => handleDispatch(order.id)}
                  className="flex-1 md:flex-initial px-4 py-1.5 bg-[#198754] hover:bg-green-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[36px]"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Dispatch Crew
                </button>
              ) : (
                <button
                  onClick={() => alert(`Updating status for ${order.id}...`)}
                  className="flex-1 md:flex-initial px-3 py-1.5 bg-[#0B3558] hover:bg-[#08243D] text-white rounded text-xs font-bold transition flex items-center justify-center gap-1 min-h-[36px]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Update Status
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkOrderPanel;

