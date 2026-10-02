import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ORDER_STATUS_CHART_COLORS } from './chartTheme';

export interface StatusSlice {
  status: string;
  count: number;
}

export interface StatusDistributionDonutProps {
  data: StatusSlice[];
  height?: number;
}

export const STATUS_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  RIDER_ASSIGNED: 'Courier Assigned',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  DISPATCHED: 'On Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Donut of the order status mix for the selected analytics window. */
export const StatusDistributionDonut: React.FC<StatusDistributionDonutProps> = ({ data, height = 260 }) => {
  const slices = data.filter((slice) => slice.count > 0);
  const isEmpty = slices.length === 0;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={isEmpty ? [{ status: 'none', count: 1 }] : slices}
            dataKey="count"
            nameKey="status"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {(isEmpty ? [{ status: 'none', count: 1 }] : slices).map((slice) => (
              <Cell
                key={slice.status}
                fill={isEmpty ? '#e2e8f0' : ORDER_STATUS_CHART_COLORS[slice.status] ?? '#94a3b8'}
              />
            ))}
          </Pie>
          {!isEmpty && (
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
              }}
              formatter={(value, name) => [Number(value ?? 0), STATUS_LABELS[String(name)] ?? String(name)]}
            />
          )}
          {!isEmpty && (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => STATUS_LABELS[value] ?? value}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-slate-400">No orders in this window</span>
        </div>
      )}
    </div>
  );
};
