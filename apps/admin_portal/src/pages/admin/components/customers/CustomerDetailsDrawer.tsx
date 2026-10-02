import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MapPin, Phone, UserRound } from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { Badge, OrderStatusBadge } from '../../../../components/ui/Badge';
import { Drawer } from '../../../../components/ui/Drawer';

export interface CustomerDetailsDrawerProps {
  customerId: string | null;
  onClose: () => void;
}

const CURRENCY = '৳';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Read-only unified customer view: profile, saved addresses, lifetime order
 *  metrics, and recent orders deep-linking into Order History. */
export const CustomerDetailsDrawer: React.FC<CustomerDetailsDrawerProps> = ({ customerId, onClose }) => {
  const navigate = useNavigate();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-customer-detail', customerId],
    queryFn: () => adminApi.getCustomerDetail(customerId as string),
    enabled: !!customerId,
  });

  const customer = detail?.customer;
  const metrics = detail?.metrics;

  return (
    <Drawer
      isOpen={!!customerId}
      onClose={onClose}
      title={customer ? customer.fullName : 'Customer Details'}
      description={customer?.phone}
    >
      {isLoading || !detail ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading customer profile...</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="text-xs text-slate-500">
                  <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer?.phone}</p>
                  {customer?.email && <p className="mt-0.5">{customer.email}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={customer?.status === 'ACTIVE' ? 'success' : customer?.status === 'SUSPENDED' ? 'danger' : 'warning'}>
                  {customer?.status?.replace('_', ' ')}
                </Badge>
                <span className="text-[11px] text-slate-500">joined {formatDate(customer?.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lifetime Orders</div>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {(metrics?.totalOrders ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                {metrics?.statusCounts?.CANCELLED ?? 0} cancelled
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lifetime Spend</div>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.lifetimeSpend ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">across {metrics?.orderCount ?? 0} effective orders</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Order Value</div>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.avgOrderValue ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Coupon Savings</div>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.totalCouponSavings ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                + {CURRENCY} {(metrics?.totalDeliveryFees ?? 0).toLocaleString()} delivery fees
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Saved Addresses</h4>
            <div className="space-y-1.5">
              {(customer?.addresses ?? []).length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">No saved addresses.</p>
              )}
              {(customer?.addresses ?? []).map((address) => (
                <div
                  key={address.id}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
                >
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {address.label}
                      {address.isDefault && (
                        <Badge variant="primary" size="sm" className="ml-1.5">Default</Badge>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{address.addressLine}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recent Orders</h4>
            <div className="space-y-1.5">
              {(detail?.recentOrders ?? []).length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">No orders yet.</p>
              )}
              {(detail?.recentOrders ?? []).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:border-primary-300 transition-colors cursor-pointer dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {order.orderNumber} · {order.vendorName}
                    </p>
                    <p className="text-[11px] text-slate-500">{formatDateTime(order.placedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {CURRENCY} {order.totalAmount.toLocaleString()}
                    </span>
                    <OrderStatusBadge status={order.status} />
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};
