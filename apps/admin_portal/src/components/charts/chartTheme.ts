/**
 * Chart color source. Values mirror tailwind.config.js tokens (primary = indigo
 * scale) because recharts SVG props need literal colors; keeping them here
 * means charts and the design system can never drift apart silently.
 */
export const CHART_COLORS = {
  primary: '#4f46e5', // primary-600
  primaryLight: '#818cf8', // primary-400
  primaryFill: '#e0e7ff', // primary-100
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  slate: '#94a3b8',
} as const;

export const ORDER_STATUS_CHART_COLORS: Record<string, string> = {
  PLACED: CHART_COLORS.sky,
  RIDER_ASSIGNED: CHART_COLORS.primaryLight,
  ACCEPTED: CHART_COLORS.primary,
  PREPARING: CHART_COLORS.amber,
  READY_FOR_PICKUP: '#d97706',
  DISPATCHED: CHART_COLORS.emerald,
  DELIVERED: '#059669',
  CANCELLED: CHART_COLORS.rose,
};

export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: '#94a3b8',
} as const;
