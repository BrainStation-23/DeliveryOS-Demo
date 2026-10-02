import { describe, expect, it } from 'vitest';
import { buildTrendBadge, formatTrendData } from './dashboardAnalytics';
import { AnalyticsOverview } from '../../../../services/adminApi';

describe('formatTrendData', () => {
  const timeseries: AnalyticsOverview['timeseries'] = [
    { bucketStart: '2026-10-01T00:00:00.000Z', orders: 5, revenue: 500, cancelled: 1 },
    { bucketStart: '2026-10-02T00:00:00.000Z', orders: 3, revenue: 300, cancelled: 0 },
  ];

  it('labels day buckets with the calendar day', () => {
    const points = formatTrendData(timeseries, 'day');
    expect(points).toEqual([
      { label: '1 Oct', orders: 5, revenue: 500 },
      { label: '2 Oct', orders: 3, revenue: 300 },
    ]);
  });

  it('labels hour buckets with local wall-clock time', () => {
    const hourly: AnalyticsOverview['timeseries'] = [
      { bucketStart: '2026-10-01T18:00:00.000Z', orders: 2, revenue: 120, cancelled: 0 },
    ];
    // Labels render in the admin's local timezone, so derive the expectation
    // from the same instant instead of hard-coding a wall-clock string.
    const expectedHour = `${String(new Date('2026-10-01T18:00:00.000Z').getHours()).padStart(2, '0')}:00`;
    expect(formatTrendData(hourly, 'hour')).toEqual([{ label: expectedHour, orders: 2, revenue: 120 }]);
  });

  it('tolerates missing timeseries payloads', () => {
    expect(formatTrendData(undefined as unknown as AnalyticsOverview['timeseries'], 'day')).toEqual([]);
  });
});

describe('buildTrendBadge', () => {
  it('marks missing baselines as unknown', () => {
    expect(buildTrendBadge(null)).toEqual({ direction: 'unknown', label: 'No baseline', invertTone: false });
  });

  it('formats zero deltas as flat', () => {
    expect(buildTrendBadge(0)).toEqual({ direction: 'flat', label: '±0%', invertTone: false });
  });

  it('formats positive deltas with a plus sign', () => {
    expect(buildTrendBadge(12.34)).toEqual({ direction: 'up', label: '+12.3%', invertTone: false });
    expect(buildTrendBadge(-12.34)).toEqual({ direction: 'down', label: '-12.3%', invertTone: false });
  });

  it('flags inverted metrics so rising values render as negative tone', () => {
    expect(buildTrendBadge(5, true).invertTone).toBe(true);
  });
});
