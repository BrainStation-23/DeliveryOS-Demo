const REGION_TIMEZONES: Record<string, string> = {
  BD: 'Asia/Dhaka',
  KSA: 'Asia/Riyadh',
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getRegionTimezone(): string {
  return REGION_TIMEZONES[process.env.REGION_MODE || 'BD'] || 'Asia/Dhaka';
}

/**
 * Wall-clock time in the active business region (vendor-local hours are stored
 * in region time, so comparisons must never use the server's UTC clock).
 */
export function getCurrentRegionTimeParts(): { dayOfWeek: number; timeHHmmss: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: getRegionTimezone(),
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  const hour = get('hour') === '24' ? '00' : get('hour');
  const timeHHmmss = `${hour}:${get('minute')}:${get('second')}`;

  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, timeHHmmss };
}

/**
 * Pure operating-hours gate: `timeHHmmss` must fall inside [openTime, closeTime]
 * in vendor-local semantics, supporting overnight windows (e.g. 18:00–02:00).
 */
export function isWithinOperatingHours(
  timeHHmmss: string,
  openTime: string,
  closeTime: string,
): boolean {
  const open = openTime.length === 5 ? `${openTime}:00` : openTime;
  const close = closeTime.length === 5 ? `${closeTime}:00` : closeTime;

  if (open <= close) {
    return timeHHmmss >= open && timeHHmmss <= close;
  }
  // Overnight shift (e.g. 18:00 - 02:00)
  return timeHHmmss >= open || timeHHmmss <= close;
}
