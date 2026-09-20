import React, { useState, useEffect } from 'react';
import { RoadEvent, EventStatus } from '../types';
import {
  X, MapPin, Bus, Clock, ShieldAlert, Wrench, CheckCircle2,
  FileText, ExternalLink, Sparkles, AlertTriangle, Trash2, Coins, Hammer
} from 'lucide-react';
import { resolveImageSrc } from '../utils/imageUtils';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { AssignWorkOrderModal } from './AssignWorkOrderModal';

interface DefectDetailModalProps {
  event: RoadEvent | null;
  onClose: () => void;
  onUpdateStatus: (eventId: string, status: EventStatus, notes?: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  onLocateOnMap?: (event: RoadEvent) => void;
  readOnly?: boolean;
}

export const DefectDetailModal: React.FC<DefectDetailModalProps> = ({
  event,
  onClose,
  onUpdateStatus,
  onDelete,
  onLocateOnMap,
  readOnly = false,
}) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<EventStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isAssignWorkOrderOpen, setIsAssignWorkOrderOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setNotes(event.reviewNotes || '');
      setActionError(null);
      setActionSuccess(null);
    }
  }, [event]);

  if (!event) return null;

  const formatIssueId = (id: string) => {
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
    return `UE-2026-${cleanId || '00124'}`;
  };

  const handleDelete = async () => {
    if (!onDelete || !event) return;
    if (!window.confirm(`Are you sure you want to delete this defect record (${formatIssueId(event.id)})?`)) {
      return;
    }
    try {
      setDeleting(true);
      setActionError(null);
      await onDelete(event.id);
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete defect event.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async (targetStatus: EventStatus) => {
    try {
      setSubmitting(true);
      setActiveAction(targetStatus);
      setActionError(null);
      await onUpdateStatus(event.id, targetStatus, notes.trim() ? notes.trim() : undefined);
      setActionSuccess(`Status updated to ${targetStatus.replace(/_/g, ' ')}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update status.');
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const imageSrc = resolveImageSrc(event.imageSnippet);
  const details = getPotholeCostDetails(event);

  /* Horizontal Lifecycle Progress Steps */
  const timelineSteps = [
    { key: 'NEW', label: 'Detected' },
    { key: 'REVIEWED', label: 'Verified' },
    { key: 'ASSIGNED_FOR_REPAIR', label: 'Assigned' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'RESOLVED', label: 'Resolved' },
  ];

  const getStepIndex = (status: EventStatus) => {
    if (status === 'NEW') return 0;
    if (status === 'REVIEWED') return 1;
    if (status === 'ASSIGNED_FOR_REPAIR') return 2;
    if (status === 'RESOLVED') return 4;
    return 0;
  };

  const currentStep = getStepIndex(event.status);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans text-[#172B3A]">
      <div className="bg-white rounded-lg border border-[#D8E0E8] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#0B3558] text-white px-6 py-4 flex items-center justify-between border-b border-[#F2A900]">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-bold tracking-tight">Road Issue Report</h3>
              <span className="bg-[#1769AA] text-white font-mono text-xs px-2 py-0.5 rounded font-bold border border-white/20">
                {formatIssueId(event.id)}
              </span>
            </div>
            <p className="text-xs text-gray-200 mt-0.5">
              SRIMS Defect Telemetry &amp; Field Verification Record
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Report Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Horizontal Status Timeline */}
          <div className="bg-[#F6F8FA] p-4 rounded border border-[#D8E0E8]">
            <div className="text-xs font-bold text-[#0B3558] uppercase tracking-wider mb-3">
              Lifecycle Progress Bar
            </div>
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#D8E0E8] -z-0"></div>
              {timelineSteps.map((step, idx) => {
                const isCompleted = idx <= currentStep;
                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                        isCompleted 
                          ? 'bg-[#0B3558] text-white border-[#0B3558]' 
                          : 'bg-white text-[#667788] border-[#D8E0E8]'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-[11px] mt-1 font-semibold ${isCompleted ? 'text-[#0B3558]' : 'text-[#667788]'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 1. Detection Information */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#0B3558] uppercase tracking-wider border-b border-[#D8E0E8] pb-1">
              1. Detection Information
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#F6F8FA] p-2.5 rounded border border-[#D8E0E8]">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Date &amp; Time</div>
                <div className="font-semibold text-[#172B3A] mt-0.5">
                  {new Date(event.timestamp).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="bg-[#F6F8FA] p-2.5 rounded border border-[#D8E0E8]">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Road Corridor</div>
                <div className="font-semibold text-[#172B3A] mt-0.5">
                  {event.busLabel}
                </div>
              </div>

              <div className="bg-[#F6F8FA] p-2.5 rounded border border-[#D8E0E8]">
                <div className="text-[10px] font-bold text-[#667788] uppercase">District &amp; State</div>
                <div className="font-semibold text-[#172B3A] mt-0.5">
                  {event.district?.name || 'Kapurthala'}, Punjab
                </div>
              </div>

              <div className="bg-[#F6F8FA] p-2.5 rounded border border-[#D8E0E8] col-span-2">
                <div className="text-[10px] font-bold text-[#667788] uppercase">GPS Coordinates</div>
                <div className="font-mono font-bold text-[#1769AA] mt-0.5">
                  {event.latitude.toFixed(6)}° N, {event.longitude.toFixed(6)}° E
                </div>
              </div>

              <div className="bg-[#F6F8FA] p-2.5 rounded border border-[#D8E0E8]">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Source Vehicle</div>
                <div className="font-semibold text-[#172B3A] mt-0.5">
                  Bus Unit UE-{event.busLabel.slice(-3)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. AI Detection & Physical Metrics */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#0B3558] uppercase tracking-wider border-b border-[#D8E0E8] pb-1">
              2. AI Detection &amp; Assessment
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#EAF4FB] p-2.5 rounded border border-[#1769AA]/20">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Detected Object</div>
                <div className="font-bold text-[#0B3558] mt-0.5">{event.type.replace('_', ' ')}</div>
              </div>

              <div className="bg-[#EAF4FB] p-2.5 rounded border border-[#1769AA]/20">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Confidence Score</div>
                <div className="font-bold text-[#1769AA] mt-0.5">{Math.round(event.confidence * 100)}%</div>
              </div>

              <div className="bg-[#EAF4FB] p-2.5 rounded border border-[#1769AA]/20">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Severity Category</div>
                <div className="font-bold text-[#C62828] mt-0.5">{event.severity || 'HIGH'}</div>
              </div>

              <div className="bg-[#EAF4FB] p-2.5 rounded border border-[#1769AA]/20">
                <div className="text-[10px] font-bold text-[#667788] uppercase">Estimated Repair Cost</div>
                <div className="font-bold text-[#198754] mt-0.5">{details.formattedCost}</div>
              </div>
            </div>
          </div>

          {/* 3. Photographic Evidence */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#0B3558] uppercase tracking-wider border-b border-[#D8E0E8] pb-1">
              3. Visual Evidence
            </h4>
            <div className="rounded border border-[#D8E0E8] overflow-hidden bg-black aspect-video flex items-center justify-center relative">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Defect visual evidence"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 text-xs p-6 text-center">
                  No camera image attached to this telemetry record.
                </div>
              )}
              <div className="absolute top-2 left-2 bg-[#0B3558] text-white text-[10px] px-2 py-0.5 rounded font-bold">
                AI Bounding Box Verified
              </div>
            </div>
          </div>

          {/* Action Notes */}
          {!readOnly && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#0B3558] uppercase tracking-wider">
                Engineering Remarks / Work Order Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter work order reference or contractor assignment notes..."
                rows={2}
                className="w-full text-xs p-2.5 border border-[#D8E0E8] rounded bg-white text-[#172B3A]"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[#F6F8FA] px-6 py-3 border-t border-[#D8E0E8] flex justify-between items-center text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#D8E0E8] text-[#667788] font-semibold rounded hover:bg-gray-100"
          >
            Close Report
          </button>

          {!readOnly && (
            <div className="flex space-x-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-2 bg-red-100 text-[#C62828] font-bold rounded border border-red-200 hover:bg-red-200"
                >
                  Delete
                </button>
              )}
              {event.status !== 'RESOLVED' && (
                <button
                  onClick={() => setIsAssignWorkOrderOpen(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F2A900] text-[#08243D] font-bold rounded hover:bg-amber-500"
                >
                  Assign Work Order
                </button>
              )}
              {event.status !== 'RESOLVED' && (
                <button
                  onClick={() => handleAction('RESOLVED')}
                  disabled={submitting}
                  className="px-4 py-2 bg-[#198754] text-white font-bold rounded hover:bg-green-700"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      <AssignWorkOrderModal
        event={event}
        isOpen={isAssignWorkOrderOpen}
        onClose={() => setIsAssignWorkOrderOpen(false)}
        onConfirmAssignment={async (id, status, formattedNotes) => {
          setNotes(formattedNotes || '');
          await onUpdateStatus(id, status, formattedNotes);
          onClose();
        }}
      />
    </div>
  );
};

export default DefectDetailModal;
