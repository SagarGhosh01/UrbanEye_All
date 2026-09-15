import React, { useState } from 'react';
import { RoadEvent, EventStatus } from '../types';
import { resolveImageSrc } from '../utils/imageUtils';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { calculateSLARemaining } from '../utils/slaCalculator';
import {
  Wrench,
  X,
  MapPin,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  User,
  HardHat,
  FileText,
  Building,
} from 'lucide-react';

interface AssignWorkOrderModalProps {
  event: RoadEvent;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAssignment: (eventId: string, status: EventStatus, notes?: string) => Promise<void>;
}

const PWD_CONTRACTOR_LEADS = [
  { id: 'lead-1', name: 'Er. Harpreet Singh', title: 'PWD Division Lead - Kapurthala Central', phone: '+91 98765 43210' },
  { id: 'lead-2', name: 'Er. Rajesh Sharma', title: 'GT Road Highway Patrol & Repair Unit', phone: '+91 98123 45678' },
  { id: 'lead-3', name: 'M/S Apex Infrastructure Ltd.', title: 'Municipal PWD Contracting Wing', phone: '+91 97890 12345' },
  { id: 'lead-4', name: 'Er. Gurpreet Kaur', title: 'District Road Maintenance Unit 4', phone: '+91 98555 67890' },
  { id: 'lead-5', name: 'Er. Vikramaditya Rao', title: 'State PWD Special Rapid Repair Squad', phone: '+91 99111 22334' },
];

const MATERIAL_SPECS = [
  'VG-30 Hot Mix Asphalt (IS:73-2013 Spec)',
  'Cold Mix Bituminous Macadam (PWD SOR 2026)',
  'Polymer Modified Bitumen (PMB-120 High Durability)',
  'Quick-Setting Rapid Patching Emulsion (ASTM D244)',
];

export const AssignWorkOrderModal: React.FC<AssignWorkOrderModalProps> = ({
  event,
  isOpen,
  onClose,
  onConfirmAssignment,
}) => {
  if (!isOpen) return null;

  const costDetails = getPotholeCostDetails(event);
  const calculatedCost = event.estimatedRepairCost || 3750;

  // Form State
  const [selectedLead, setSelectedLead] = useState(PWD_CONTRACTOR_LEADS[0].name);
  const [contractorPhone, setContractorPhone] = useState(PWD_CONTRACTOR_LEADS[0].phone);
  const [allocatedBudget, setAllocatedBudget] = useState<number>(calculatedCost);
  const [priority, setPriority] = useState<'EMERGENCY_24H' | 'HIGH_48H' | 'STANDARD_7D'>('HIGH_48H');
  const [materialSpec, setMaterialSpec] = useState(MATERIAL_SPECS[0]);
  const [customDirectives, setCustomDirectives] = useState(
    `Deploy PWD repair crew to clean cavity at (${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}), apply tack coat, lay bituminous mix, and compact to 98% density. Upload before & after verification photos.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workOrderId = `WO-2026-${(event.district?.code || 'PWD').toUpperCase()}-${event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;

  const handleLeadChange = (name: string) => {
    setSelectedLead(name);
    const found = PWD_CONTRACTOR_LEADS.find((l) => l.name === name);
    if (found) setContractorPhone(found.phone);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formattedNotes = `[WORK ORDER ASSIGNED] Lead: ${selectedLead} (${contractorPhone}) | Priority: ${priority} | Material: ${materialSpec} | Budget: ₹${allocatedBudget.toLocaleString('en-IN')} | Instructions: ${customDirectives}`;
      await onConfirmAssignment(event.id, 'ASSIGNED_FOR_REPAIR', formattedNotes);
      onClose();
    } catch (err) {
      console.error('Failed to assign work order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintWorkOrder = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col text-white">

        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0b2545] via-[#102a4d] to-orange-950/40 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  PWD / NHAI Work Order Assignment Portal
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {workOrderId}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Official Municipal Road Repair Dispatch & Schedule of Rates (SOR) Tender Allocation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
          
          {/* Top Info Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* Left Column: Defect Snapshot & Location */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-400" />
                    <span>{event.district?.name || 'Kapurthala'} District</span>
                  </span>
                  <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {event.type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-800 h-44 bg-black flex items-center justify-center">
                  <img
                    src={resolveImageSrc(event.imageSnippet)}
                    alt="Defect Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/90 text-orange-400 text-[10px] font-mono px-2 py-0.5 rounded border border-orange-500/30 font-bold">
                    SEVERITY: {event.severity || 'HIGH'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">LAT / LON</span>
                    <span className="font-bold text-slate-200">{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">DEPTH (EST.)</span>
                    <span className="font-bold text-amber-300">{event.depthCm ? `${event.depthCm} cm` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Itemized PWD Schedule of Rates Breakdown */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-extrabold text-xs text-orange-400 uppercase tracking-wider flex items-center justify-between">
                  <span>PWD SOR Budget Allocation</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                </h4>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bituminous Mix Material:</span>
                    <span>₹{Math.round(calculatedCost * 0.35).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">PWD Labour Crew Allocation:</span>
                    <span>₹{Math.round(calculatedCost * 0.30).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Roller & Cutter Deployment:</span>
                    <span>₹{Math.round(calculatedCost * 0.23).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-emerald-400 text-sm">
                    <span>Total Tender Allocation:</span>
                    <span>₹{allocatedBudget.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Work Order Assignment Form */}
            <div className="md:col-span-7 space-y-4">
              
              {/* Select PWD Contractor Lead */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                  <HardHat className="w-3.5 h-3.5 text-orange-400" />
                  <span>Assign Field Division / Contractor Lead</span>
                </label>
                <select
                  value={selectedLead}
                  onChange={(e) => handleLeadChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                >
                  {PWD_CONTRACTOR_LEADS.map((lead) => (
                    <option key={lead.id} value={lead.name}>
                      {lead.name} — {lead.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Priority & SLA Deadline</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                  >
                    <option value="EMERGENCY_24H">🚨 24 Hours (Emergency Patch)</option>
                    <option value="HIGH_48H">⚡ 48 Hours (High Priority Corridor)</option>
                    <option value="STANDARD_7D">📅 7 Days (Standard PWD Schedule)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Allocated Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={allocatedBudget}
                    onChange={(e) => setAllocatedBudget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              {/* Material Specification */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-400" />
                  <span>Material Specification Standard</span>
                </label>
                <select
                  value={materialSpec}
                  onChange={(e) => setMaterialSpec(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                >
                  {MATERIAL_SPECS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Work Directives */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Field Directives & Inspection Instructions</span>
                </label>
                <textarea
                  rows={3}
                  value={customDirectives}
                  onChange={(e) => setCustomDirectives(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrintWorkOrder}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Print Work Order Document</span>
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-lg shadow-orange-600/20 flex items-center justify-center space-x-2 transition active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Dispatching Work Order...</span>
              ) : (
                <>
                  <Wrench className="w-4 h-4 text-orange-200" />
                  <span>Confirm Assignment & Dispatch Crew</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Dedicated Printable PWD Work Order Certificate (Only visible on window.print()) */}
      <div id="printable-pwd-work-order" className="hidden">
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-pwd-work-order, #printable-pwd-work-order * {
              visibility: visible !important;
            }
            #printable-pwd-work-order {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              color: #000000 !important;
              background: #ffffff !important;
              font-family: Arial, sans-serif !important;
              padding: 24px !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>
        <div style={{ border: '3px double #000', padding: '24px', backgroundColor: '#fff', color: '#000' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>PUBLIC WORKS DEPARTMENT (PWD)</h1>
              <h2 style={{ fontSize: '13px', margin: '4px 0 0 0', textTransform: 'uppercase' }}>
                Municipal Infrastructure & Rapid Road Repair Division — {event.district?.name || 'Kapurthala'}
              </h2>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>OFFICIAL WORK ORDER</div>
              <div style={{ fontSize: '12px', color: '#333' }}>{workOrderId}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Date: {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          {/* Location & Defect Snapshot */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5', width: '25%' }}>Defect Type</td>
                <td style={{ padding: '6px', border: '1px solid #ccc' }}>{event.type.replace(/_/g, ' ')}</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5', width: '25%' }}>Severity Level</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', color: event.severity === 'CRITICAL' ? '#d32f2f' : '#333' }}>{event.severity || 'HIGH'}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>GPS Coordinates</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontFamily: 'monospace' }}>{event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Bus Fleet / Sensor ID</td>
                <td style={{ padding: '6px', border: '1px solid #ccc' }}>{event.busLabel}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Estimated Cavity Size</td>
                <td style={{ padding: '6px', border: '1px solid #ccc' }}>Ø {costDetails.formattedDiameter} ({event.depthCm ? `${event.depthCm}cm depth` : 'Standard depth'})</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Target SLA Repair Window</td>
                <td style={{ padding: '6px', border: '1px solid #ccc', fontWeight: 'bold' }}>{priority.replace(/_/g, ' ')}</td>
              </tr>
            </tbody>
          </table>

          {/* Contractor & Material Directives */}
          <div style={{ marginBottom: '16px', fontSize: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
              CONTRACTOR & MATERIAL SPECIFICATIONS
            </h3>
            <p style={{ margin: '4px 0' }}><strong>Assigned PWD Lead:</strong> {selectedLead} ({contractorPhone})</p>
            <p style={{ margin: '4px 0' }}><strong>Material Standard:</strong> {materialSpec}</p>
            <p style={{ margin: '4px 0' }}><strong>Field Directives:</strong> {customDirectives}</p>
          </div>

          {/* Financial Breakdown */}
          <div style={{ marginBottom: '24px', fontSize: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
              SCHEDULE OF RATES (SOR 2026) TENDER ALLOCATION
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '6px', border: '1px solid #ccc', textAlign: 'left' }}>Component Description</th>
                  <th style={{ padding: '6px', border: '1px solid #ccc', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '6px', border: '1px solid #ccc' }}>Bituminous Asphalt / Cold Mix Raw Material</td>
                  <td style={{ padding: '6px', border: '1px solid #ccc', textAlign: 'right', fontFamily: 'monospace' }}>₹{Math.round(allocatedBudget * 0.35).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', border: '1px solid #ccc' }}>PWD Labour Crew & Safety Traffic Marshalling</td>
                  <td style={{ padding: '6px', border: '1px solid #ccc', textAlign: 'right', fontFamily: 'monospace' }}>₹{Math.round(allocatedBudget * 0.30).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', border: '1px solid #ccc' }}>Compactor Roller & Road Cutter Deployment</td>
                  <td style={{ padding: '6px', border: '1px solid #ccc', textAlign: 'right', fontFamily: 'monospace' }}>₹{Math.round(allocatedBudget * 0.23).toLocaleString('en-IN')}</td>
                </tr>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>TOTAL APPROVED TENDER VALUE</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px' }}>₹{allocatedBudget.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #000', fontSize: '11px', textAlign: 'center' }}>
            <div style={{ width: '30%' }}>
              <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '30px' }}></div>
              <div>Prepared By (AI GIS System)</div>
            </div>
            <div style={{ width: '30%' }}>
              <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '30px' }}></div>
              <div>Executive Engineer (PWD)</div>
            </div>
            <div style={{ width: '30%' }}>
              <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '30px' }}></div>
              <div>Contractor Acceptance Signature</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
