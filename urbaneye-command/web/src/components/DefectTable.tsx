import React, { useState } from 'react';
import { RoadEvent, EventStatus, DefectType } from '../types';
import { Eye, CheckCircle2, Wrench, AlertTriangle, Image as ImageIcon, Trash2, MapPin, Bus, Clock, Download } from 'lucide-react';
import { getCategoryColor, getCategoryDisplayName } from '../constants/detectionCategories';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { resolveImageSrc, DEFAULT_ROAD_DEFECT_SVG } from '../utils/imageUtils';

interface DefectTableProps {
  events: RoadEvent[];
  onUpdateStatus: (eventId: string, status: EventStatus, notes?: string) => Promise<void>;
  onSelectEvent?: (event: RoadEvent) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onPurgeEvents?: () => Promise<void>;
  isLoading?: boolean;
}

export const DefectTable: React.FC<DefectTableProps> = ({
  events,
  onUpdateStatus,
  onSelectEvent,
  onDeleteEvent,
  onPurgeEvents,
  isLoading = false,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notesModalEvent, setNotesModalEvent] = useState<{ id: string; targetStatus: EventStatus } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  /* Filtering */
  const filteredEvents = events.filter((e) => {
    if (selectedStatus !== 'ALL' && e.status !== selectedStatus) return false;
    if (selectedType !== 'ALL' && e.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !e.busLabel.toLowerCase().includes(q) &&
        !(e.district?.name.toLowerCase().includes(q)) &&
        !e.type.toLowerCase().includes(q) &&
        !e.id.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleStatusClick = (eventId: string, targetStatus: EventStatus) => {
    setNotesModalEvent({ id: eventId, targetStatus });
    setReviewNote('');
    setModalError(null);
  };

  const submitStatusChange = async () => {
    if (!notesModalEvent) return;
    try {
      setActionLoadingId(notesModalEvent.id);
      setModalError(null);
      await onUpdateStatus(notesModalEvent.id, notesModalEvent.targetStatus, reviewNote);
      setNotesModalEvent(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  /* Format Issue ID as UE-2026-00124 */
  const formatIssueId = (id: string) => {
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
    return `UE-2026-${cleanId || '00124'}`;
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-[#C62828] border border-red-200">Pending</span>;
      case 'REVIEWED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EAF4FB] text-[#1769AA] border border-[#1769AA]/30">Verified</span>;
      case 'ASSIGNED_FOR_REPAIR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-[#D98E04] border border-amber-200">Assigned</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-[#198754] border border-green-200">Resolved</span>;
    }
  };

  const getSeverityBadge = (severity?: string | null) => {
    const sev = (severity || 'HIGH').toUpperCase();
    if (sev === 'CRITICAL' || sev === 'HIGH') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#C62828] border border-red-200">High</span>;
    }
    if (sev === 'MEDIUM') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-[#D98E04] border border-amber-200">Medium</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#1769AA] border border-blue-200">Low</span>;
  };

  const handleExportCsv = () => {
    if (!filteredEvents.length) return;
    const headers = ['Issue_ID', 'Category', 'Severity', 'Location', 'District', 'Latitude', 'Longitude', 'Status', 'Timestamp'];
    const rows = filteredEvents.map((e) => [
      `"${formatIssueId(e.id)}"`,
      `"${e.type}"`,
      `"${e.severity || 'HIGH'}"`,
      `"${e.busLabel}"`,
      `"${e.district?.name || 'Central'}"`,
      e.latitude,
      e.longitude,
      `"${e.status}"`,
      `"${e.timestamp}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `UrbanEye_Defect_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded border border-[#D8E0E8] shadow-xs overflow-hidden text-[#172B3A] font-sans">
      
      {/* Table Controls */}
      <div className="p-3.5 bg-[#F6F8FA] border-b border-[#D8E0E8] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-bold text-[#0B3558] tracking-tight uppercase">
            UrbanEye Defect Register
          </h3>
          <span className="bg-[#EAF4FB] text-[#1769AA] text-xs font-bold px-2 py-0.5 rounded border border-[#1769AA]/20">
            {filteredEvents.length} Items
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Search Issue ID, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-[#D8E0E8] rounded text-xs bg-white text-[#172B3A] focus:outline-none"
          />
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8E0E8] rounded text-xs bg-white text-[#172B3A]"
          >
            <option value="ALL">All Categories</option>
            <option value="POTHOLE">Potholes</option>
            <option value="SURFACE_DAMAGE">Surface Damage</option>
            <option value="MISSING_DIVIDER">Missing Dividers</option>
            <option value="FADED_ZEBRA_CROSSING">Zebra Crossings</option>
            <option value="DAMAGED_SIGNBOARD">Damaged Signs</option>
            <option value="WATERLOGGING">Waterlogging</option>
            <option value="ROAD_CRACK">Road Cracks</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8E0E8] rounded text-xs bg-white text-[#172B3A]"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">Pending</option>
            <option value="REVIEWED">Verified</option>
            <option value="ASSIGNED_FOR_REPAIR">Assigned</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <button
            onClick={handleExportCsv}
            disabled={!filteredEvents.length}
            className="px-3 py-1.5 bg-[#0B3558] text-white rounded text-xs font-semibold hover:bg-[#08243D] flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#0B3558] text-white font-bold border-b border-[#D8E0E8]">
            <tr>
              <th className="py-2.5 px-3">Issue ID</th>
              <th className="py-2.5 px-3">Issue Type</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">District</th>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Detected</th>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8E0E8] bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-[#667788]">
                  Loading operational detection events...
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-[#667788]">
                  No road issues found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredEvents.map((event, idx) => (
                <tr 
                  key={event.id}
                  className={`hover:bg-[#EAF4FB]/50 transition ${idx % 2 === 1 ? 'bg-[#F6F8FA]/60' : 'bg-white'}`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3558]">
                    {formatIssueId(event.id)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#172B3A]">
                    {getCategoryDisplayName(event.type)}
                  </td>
                  <td className="py-2.5 px-3 text-[#172B3A]">
                    {event.busLabel}
                  </td>
                  <td className="py-2.5 px-3 text-[#667788]">
                    {event.district?.name || 'Central'}
                  </td>
                  <td className="py-2.5 px-3">
                    {getSeverityBadge(event.severity)}
                  </td>
                  <td className="py-2.5 px-3 text-[#667788] font-mono text-[11px]">
                    {new Date(event.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2.5 px-3 text-[#667788]">
                    Bus UE-{event.busLabel.slice(-3)}
                  </td>
                  <td className="py-2.5 px-3">
                    {getStatusBadge(event.status)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {onSelectEvent && (
                        <button
                          onClick={() => onSelectEvent(event)}
                          className="px-2.5 py-1 bg-[#1769AA] text-white rounded text-[11px] font-bold hover:bg-[#0B3558] transition"
                        >
                          View
                        </button>
                      )}
                      {event.status === 'NEW' && (
                        <button
                          onClick={() => handleStatusClick(event.id, 'ASSIGNED_FOR_REPAIR')}
                          className="px-2.5 py-1 bg-[#F2A900] text-[#08243D] rounded text-[11px] font-bold hover:bg-amber-500 transition"
                        >
                          Assign
                        </button>
                      )}
                      {event.status === 'ASSIGNED_FOR_REPAIR' && (
                        <button
                          onClick={() => handleStatusClick(event.id, 'RESOLVED')}
                          className="px-2.5 py-1 bg-[#198754] text-white rounded text-[11px] font-bold hover:bg-green-700 transition"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Notes Modal */}
      {notesModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D8E0E8] shadow-lg max-w-md w-full p-5">
            <h4 className="text-sm font-bold text-[#0B3558] mb-1">
              Update Status: <span className="text-[#1769AA]">{notesModalEvent.targetStatus.replace('_', ' ')}</span>
            </h4>
            <p className="text-xs text-[#667788] mb-3">
              Enter inspection remarks or contractor work order notes:
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Work order #402 dispatched to field team..."
              rows={3}
              className="w-full text-xs p-2.5 border border-[#D8E0E8] rounded mb-3 text-[#172B3A]"
            />
            {modalError && (
              <div className="mb-3 p-2 bg-red-50 text-[#C62828] text-xs rounded border border-red-200">
                {modalError}
              </div>
            )}
            <div className="flex justify-end space-x-2 text-xs">
              <button
                onClick={() => setNotesModalEvent(null)}
                className="px-3 py-1.5 border border-[#D8E0E8] text-[#667788] rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitStatusChange}
                disabled={actionLoadingId !== null}
                className="px-4 py-1.5 bg-[#0B3558] text-white rounded font-bold hover:bg-[#08243D]"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DefectTable;
