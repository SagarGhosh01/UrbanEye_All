export interface SLAResult {
  slaHoursTotal: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isBreached: boolean;
  overdueHours: number;
  formattedCountdown: string;
  status: 'IN_SLA' | 'WARNING' | 'BREACHED';
}

export function getSLAHoursTotal(severity?: string, type?: string): number {
  if (type === 'ANPR_INCIDENT' || type === 'HIT_AND_RUN' || severity === 'CRITICAL') {
    return 12; // Emergency SLA: 12 Hours
  }
  if (severity === 'HIGH' || type === 'POTHOLE' || type === 'MISSING_DIVIDER') {
    return 24; // High Priority SLA: 24 Hours
  }
  if (severity === 'MEDIUM' || type === 'SURFACE_DAMAGE' || type?.includes('CRACK')) {
    return 48; // Medium Priority SLA: 48 Hours
  }
  return 168; // Standard SLA: 7 Days (168 Hours)
}

export function calculateSLARemaining(timestamp: string | number | Date, severity?: string, type?: string): SLAResult {
  const slaHoursTotal = getSLAHoursTotal(severity, type);
  const createdTime = new Date(timestamp).getTime();
  const slaDeadlineTime = createdTime + slaHoursTotal * 3600 * 1000;
  const now = Date.now();

  const diffMs = slaDeadlineTime - now;

  if (diffMs <= 0) {
    const overdueMs = Math.abs(diffMs);
    const overdueHours = Math.floor(overdueMs / (3600 * 1000));
    const overdueMins = Math.floor((overdueMs % (3600 * 1000)) / (60 * 1000));
    return {
      slaHoursTotal,
      hoursRemaining: 0,
      minutesRemaining: 0,
      isBreached: true,
      overdueHours,
      formattedCountdown: `OVERDUE +${overdueHours}h ${overdueMins}m`,
      status: 'BREACHED',
    };
  }

  const hoursRemaining = Math.floor(diffMs / (3600 * 1000));
  const minutesRemaining = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  const isWarning = hoursRemaining < 4;

  return {
    slaHoursTotal,
    hoursRemaining,
    minutesRemaining,
    isBreached: false,
    overdueHours: 0,
    formattedCountdown: `${hoursRemaining}h ${minutesRemaining}m remaining`,
    status: isWarning ? 'WARNING' : 'IN_SLA',
  };
}
