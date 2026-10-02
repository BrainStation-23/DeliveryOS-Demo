import { describe, expect, it } from 'vitest';
import { resolveDateRange } from './orderDateRange';

// Fixed reference clock: October 2, 2026, 15:30 local time.
const NOW = new Date(2026, 9, 2, 15, 30, 0, 0);

describe('resolveDateRange', () => {
  it('TODAY spans the full local business day inclusive', () => {
    const range = resolveDateRange('TODAY', '', '', NOW);
    expect(range.dateFromIso).toBe(new Date(2026, 9, 2, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 9, 2, 23, 59, 59, 999).toISOString());
  });

  it('YESTERDAY spans the previous local day inclusive', () => {
    const range = resolveDateRange('YESTERDAY', '', '', NOW);
    expect(range.dateFromIso).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 9, 1, 23, 59, 59, 999).toISOString());
  });

  it('LAST_7_DAYS covers six days back through today end-of-day', () => {
    const range = resolveDateRange('LAST_7_DAYS', '', '', NOW);
    expect(range.dateFromIso).toBe(new Date(2026, 8, 26, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 9, 2, 23, 59, 59, 999).toISOString());
  });

  it('THIS_MONTH starts at the first of the current local month', () => {
    const range = resolveDateRange('THIS_MONTH', '', '', NOW);
    expect(range.dateFromIso).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 9, 2, 23, 59, 59, 999).toISOString());
  });

  it('CUSTOM converts yyyy-MM-dd inputs to inclusive local-day ISO bounds', () => {
    const range = resolveDateRange('CUSTOM', '2026-09-05', '2026-09-10', NOW);
    expect(range.dateFromIso).toBe(new Date(2026, 8, 5, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 8, 10, 23, 59, 59, 999).toISOString());
  });

  it('CUSTOM tolerates partially filled ranges (open-ended windows)', () => {
    expect(resolveDateRange('CUSTOM', '2026-09-05', '', NOW)).toEqual({
      dateFromIso: new Date(2026, 8, 5, 0, 0, 0, 0).toISOString(),
    });
    expect(resolveDateRange('CUSTOM', '', '2026-09-10', NOW)).toEqual({
      dateToIso: new Date(2026, 8, 10, 23, 59, 59, 999).toISOString(),
    });
    expect(resolveDateRange('CUSTOM', '', '', NOW)).toEqual({});
  });

  it('ALL_TIME sends no date bounds so the full ledger is queried', () => {
    expect(resolveDateRange('ALL_TIME', 'ignored', 'ignored', NOW)).toEqual({});
  });

  it('YESTERDAY rolls across month boundaries correctly', () => {
    const range = resolveDateRange('YESTERDAY', '', '', new Date(2026, 9, 1, 10, 0, 0, 0));
    expect(range.dateFromIso).toBe(new Date(2026, 8, 30, 0, 0, 0, 0).toISOString());
    expect(range.dateToIso).toBe(new Date(2026, 8, 30, 23, 59, 59, 999).toISOString());
  });
});
