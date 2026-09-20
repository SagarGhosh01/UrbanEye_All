import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Truck, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

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
    if (val === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="bg-white border border-[#D8E0E8] rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      <div className="bg-[#0B3558] px-4 py-3 flex items-center justify-between shrink-0">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#90CAF9]" />
          Maintenance Work Orders
        </h3>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 bg-[#1769AA] hover:bg-blue-600 text-white rounded text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          Auto-Generate from Critical
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F6F8FA]">
        {loading && <div className="text-center text-[#667788] text-xs py-4">Loading orders...</div>}
        
        {!loading && orders.length === 0 && (
          <div className="text-center text-[#667788] text-xs py-8">
            No work orders found. Click "Auto-Generate" to create work orders for critical defects.
          </div>
        )}

        {orders.map(order => (
          <div key={order.id} className="bg-white border border-[#D8E0E8] p-3 rounded-lg shadow-sm flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#172B3A] text-sm">{order.title}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  order.status === 'PROPOSED' ? 'bg-amber-50 border-amber-200 text-[#D98E04]' : 'bg-emerald-50 border-emerald-200 text-[#198754]'
                }`}>
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-[#667788] leading-relaxed">{order.description}</p>
              <div className="flex items-center gap-4 pt-1">
                <span className="text-[10px] font-mono font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Score: {order.impactScore}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#1769AA] flex items-center gap-1">
                  Cost: {formatCurrency(order.estimatedCostINR)}
                </span>
                <span className="text-[10px] font-mono text-[#667788] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex sm:flex-col justify-end items-end gap-2 border-t sm:border-t-0 sm:border-l border-[#D8E0E8] pt-3 sm:pt-0 sm:pl-4">
              {order.status === 'PROPOSED' ? (
                <button
                  onClick={() => handleDispatch(order.id)}
                  className="w-full px-4 py-2 bg-[#198754] hover:bg-green-700 text-white rounded shadow-sm text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Dispatch Crew
                </button>
              ) : (
                <div className="w-full px-4 py-2 bg-[#F6F8FA] border border-[#D8E0E8] text-[#198754] rounded text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Dispatched
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
