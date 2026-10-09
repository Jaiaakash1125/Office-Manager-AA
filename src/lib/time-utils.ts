/**
 * Time utility functions for Office Manager (IST / standard office hours)
 */

// Default office timezone: Asia/Kolkata (IST)
export const OFFICE_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current date string in YYYY-MM-DD in the office timezone
 */
export function getOfficeDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Formats ISO timestamp to 12-hour time (e.g., 09:45 AM)
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats date string to friendly readable format (e.g., Oct 09, 2026)
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Checks if a given login timestamp is late (after 10:00:00 AM IST)
 */
export function checkIsLate(isoString: string): boolean {
  const date = new Date(isoString);
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timePart = timeFormatter.format(date); // e.g. "10:15"
  const [hour, minute] = timePart.split(':').map(Number);

  if (hour > 10) return true;
  if (hour === 10 && minute > 0) return true;
  return false;
}

/**
 * Calculates total elapsed duration between login and logout (or last active)
 */
export function calculateDurationHours(
  loginTime: string,
  logoutTime: string | null | undefined,
  fallbackTime?: string
): { hours: number; minutes: number; formatted: string } {
  const start = new Date(loginTime).getTime();
  const end = logoutTime
    ? new Date(logoutTime).getTime()
    : fallbackTime
    ? new Date(fallbackTime).getTime()
    : Date.now();

  const diffMs = Math.max(0, end - start);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`,
  };
}

/**
 * Formats active seconds into hours and minutes
 */
export function formatActiveSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, seconds || 0);
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * Checks if a bill date is 30 or more days older than today
 */
export function isBillOverdue30Days(billDateString: string, status: string, refDateStr?: string): boolean {
  if (status === 'paid' || !billDateString) return false;
  const billDate = new Date(billDateString);
  if (isNaN(billDate.getTime())) return false;
  
  const today = refDateStr ? new Date(refDateStr) : (typeof window !== 'undefined' ? new Date() : new Date('2026-10-09'));
  const diffTime = today.getTime() - billDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 30;
}

/**
 * Calculates days overdue
 */
export function getDaysOverdue(billDateString: string, refDateStr?: string): number {
  if (!billDateString) return 0;
  const billDate = new Date(billDateString);
  if (isNaN(billDate.getTime())) return 0;
  
  const today = refDateStr ? new Date(refDateStr) : (typeof window !== 'undefined' ? new Date() : new Date('2026-10-09'));
  const diffTime = today.getTime() - billDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}
