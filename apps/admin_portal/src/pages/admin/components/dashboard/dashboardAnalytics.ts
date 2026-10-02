import { AnalyticsOverview } from '../../../../services/adminApi';

export interface TrendPoint {
  label: string;
  orders: number;
  revenue: number;
}

/** Maps analytics timeseries buckets to chart points with window-aware labels
 *  (day buckets show the calendar day; hour buckets show wall-clock time). */
export function formatTrendData(
  timeseries: AnalyticsOverview['timeseries'] | undefined | null,
  granularity: 'day' | 'hour',
): TrendPoint[] {
  return (timeseries || []).map((point) => {
    const date = new Date(point.bucketStart);
    const label =
      granularity === 'hour'
        ? `${String(date.getHours()).padStart(2, '0')}:00`
        : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return { label, orders: point.orders, revenue: point.revenue };
  });
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface TrendBadge {
  direction: TrendDirection;
  label: string;
  /** true when a rising number is undesirable (cancellations, delivery time). */
  invertTone: boolean;
}

/** Renders the vs-previous-window delta for a metric card. `delta === null`
 *  means the previous window had no comparable baseline. */
export function buildTrendBadge(delta: number | null, invert = false): TrendBadge {
  if (delta === null) {
    return { direction: 'unknown', label: 'No baseline', invertTone: false };
  }
  if (delta === 0) {
    return { direction: 'flat', label: '±0%', invertTone: false };
  }
  const direction = delta > 0 ? 'up' : 'down';
  const label = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
  return { direction, label, invertTone: invert };
}
