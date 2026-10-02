import React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_TICK_STYLE, CHART_COLORS } from './chartTheme';

export interface TrendChartPoint {
  label: string;
  orders: number;
  revenue: number;
}

export interface OrdersRevenueTrendChartProps {
  data: TrendChartPoint[];
  height?: number;
}

/** Dashboard trend chart: order volume (bars) overlaid with gross volume
 *  (area, secondary axis). Dark-mode aware via literal chart theme tokens. */
export const OrdersRevenueTrendChart: React.FC<OrdersRevenueTrendChartProps> = ({ data, height = 280 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.primaryLight} stopOpacity={0.35} />
          <stop offset="95%" stopColor={CHART_COLORS.primaryLight} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
      <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} minTickGap={16} />
      <YAxis yAxisId="orders" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
      <YAxis
        yAxisId="revenue"
        orientation="right"
        tick={AXIS_TICK_STYLE}
        tickLine={false}
        axisLine={false}
        width={48}
        tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
      />
      <Tooltip
        contentStyle={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          fontSize: 12,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        }}
        formatter={(value, name) =>
          name === 'Gross Volume (৳)'
            ? [`৳ ${Number(value ?? 0).toLocaleString()}`, name as string]
            : [Number(value ?? 0), name as string]
        }
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Bar yAxisId="orders" dataKey="orders" name="Orders" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={28} />
      <Area
        yAxisId="revenue"
        type="monotone"
        dataKey="revenue"
        name="Gross Volume (৳)"
        stroke={CHART_COLORS.primaryLight}
        strokeWidth={2}
        fill="url(#revenueGradient)"
      />
    </ComposedChart>
  </ResponsiveContainer>
);
