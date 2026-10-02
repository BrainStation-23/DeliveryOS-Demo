export type DatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'THIS_MONTH'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface DateRange {
  dateFromIso?: string;
  dateToIso?: string;
}

/**
 * Resolves a date preset (plus optional yyyy-MM-dd custom bounds) into
 * inclusive ISO timestamps spanning local business days — identical window
 * semantics to the vendor portal's sales ledger filtering.
 */
export function resolveDateRange(
  preset: DatePreset,
  customStartDate: string,
  customEndDate: string,
  now: Date = new Date(),
): DateRange {
  if (preset === 'TODAY') {
    return {
      dateFromIso: startOfDay(now).toISOString(),
      dateToIso: endOfDay(now).toISOString(),
    };
  }

  if (preset === 'YESTERDAY') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      dateFromIso: startOfDay(yesterday).toISOString(),
      dateToIso: endOfDay(yesterday).toISOString(),
    };
  }

  if (preset === 'LAST_7_DAYS') {
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    return {
      dateFromIso: startOfDay(past7).toISOString(),
      dateToIso: endOfDay(now).toISOString(),
    };
  }

  if (preset === 'THIS_MONTH') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return {
      dateFromIso: firstOfMonth.toISOString(),
      dateToIso: endOfDay(now).toISOString(),
    };
  }

  if (preset === 'CUSTOM') {
    const range: DateRange = {};
    if (customStartDate) {
      const [y, m, d] = customStartDate.split('-').map(Number);
      range.dateFromIso = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    }
    if (customEndDate) {
      const [y, m, d] = customEndDate.split('-').map(Number);
      range.dateToIso = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
    }
    return range;
  }

  return {};
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
