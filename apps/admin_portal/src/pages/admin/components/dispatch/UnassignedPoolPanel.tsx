import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Clock } from 'lucide-react';
import { AdminOrder } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { GoogleMapsLink } from '../../../../components/common/GoogleMapsLink';
import { EmptyState } from '../../../../components/common/EmptyState';
import { computeUnassignedPoolSummary } from './unassignedPool';

interface UnassignedPoolPanelProps {
  orders: AdminOrder[];
  idleCount: number;
  onlineCount: number;
}

export const UnassignedPoolPanel: React.FC<UnassignedPoolPanelProps> = ({
  orders,
  idleCount,
  onlineCount,
}) => {
  const summary = computeUnassignedPoolSummary(orders);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between mb-3">
          <span>Unassigned Order Pool</span>
          <Badge variant="warning">{summary.waitingCount} Waiting</Badge>
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Orders requiring courier pickup. Click to jump to the Order Lifecycle Monitor to force-assign.
        </p>

        {summary.waitingCount === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            message="All placed orders are currently secured by delivery riders!"
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  <span>{order.orderNumber}</span>
                  <span className="text-primary-600 dark:text-primary-400">৳{order.totalAmount}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 truncate mb-1">{order.vendorName}</div>
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 mb-2">
                  <span className="truncate">To: {order.deliveryAddress}</span>
                  <GoogleMapsLink
                    variant="icon"
                    latitude={order.deliveryLatitude}
                    longitude={order.deliveryLongitude}
                    addressFallback={order.deliveryAddress}
                    title="Open delivery location on Google Maps"
                  />
                </div>
                <Link
                  to={`/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400"
                >
                  Assign Rider Now <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Unassigned Dispatch Radar
        </h3>
        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex justify-between">
            <span>Waiting Orders:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary.waitingCount} orders</span>
          </div>
          <div className="flex justify-between">
            <span>Pool Volume:</span>
            <span className="font-semibold text-primary-600 dark:text-primary-400">
              ৳{summary.poolVolume.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Max Order Wait:</span>
            <span
              className={`font-semibold ${
                summary.maxAgingMinutes >= 15 ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {summary.waitingCount > 0 ? `${summary.maxAgingMinutes} mins` : '0 mins'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Available Couriers:</span>
            <span className="font-semibold text-emerald-600">
              {idleCount} idle ({onlineCount} online)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
