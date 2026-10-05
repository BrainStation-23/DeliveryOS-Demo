import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Bike,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  Mail,
  PackageCheck,
  Phone,
  Receipt,
  ShieldCheck,
  ShieldOff,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { Badge, OrderStatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Drawer } from '../../../../components/ui/Drawer';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { GoogleMapsLink } from '../../../../components/common/GoogleMapsLink';
import { DetailMetricCard } from '../../../../components/common/DetailMetricCard';
import { OrderDetailsModal } from '../../../../components/orders/OrderDetailsModal';
import { CashLimitModal } from './CashLimitModal';
import { cn } from '../../../../utils/cn';
import { extractApiError } from '../../../../utils/apiError';

export interface RiderDetailsDrawerProps {
  riderId: string | null;
  onClose: () => void;
  onError: (message: string) => void;
}

const CURRENCY = '৳';

export const STATUS_BADGE_VARIANT: Record<string, 'success' | 'info' | 'default'> = {
  ONLINE: 'success',
  ON_TRIP: 'info',
  OFFLINE: 'default',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return 'Unknown';
  switch (method.toUpperCase()) {
    case 'CASH_ON_DELIVERY':
      return 'Cash on Delivery (COD)';
    case 'BKASH':
      return 'bKash';
    case 'NAGAD':
      return 'Nagad';
    case 'ROCKET':
      return 'Rocket';
    case 'CARD':
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'Card Payment';
    case 'DIGITAL_WALLET':
      return 'Digital Wallet';
    default:
      return method.replace(/_/g, ' ');
  }
}

export function getInitials(name: string | undefined): string {
  if (!name) return 'RD';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Unified courier details view: profile, cash safety state, lifetime metrics,
 *  active trip, collapsible recent orders with popup order details, and collapsible COD deposit trail. */
export const RiderDetailsDrawer: React.FC<RiderDetailsDrawerProps> = ({ riderId, onClose, onError }) => {
  const queryClient = useQueryClient();

  // Modal & Governance action states
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isSuspendConfirmOpen, setIsSuspendConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Collapsible section visibility states (synchronized with CustomerDetailsDrawer)
  const [isOrdersSectionOpen, setIsOrdersSectionOpen] = useState(true);
  const [isDepositsSectionOpen, setIsDepositsSectionOpen] = useState(true);

  // Popup order details modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Copy phone clipboard feedback
  const [copiedPhone, setCopiedPhone] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-rider-detail', riderId],
    queryFn: () => adminApi.getRiderDetail(riderId as string),
    enabled: !!riderId,
  });

  const { data: selectedOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['admin-order-detail', selectedOrderId],
    queryFn: () => adminApi.getOrderById(selectedOrderId as string),
    enabled: !!selectedOrderId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-rider-detail', riderId] });
    queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
    queryClient.invalidateQueries({ queryKey: ['admin-riders'] });
  };

  const approvalMutation = useMutation({
    mutationFn: (isApproved: boolean) => adminApi.setRiderApproval(riderId as string, isApproved),
    onSuccess: () => {
      invalidateAll();
      setIsSuspendConfirmOpen(false);
      setActionError(null);
    },
    onError: (err) => {
      const msg = extractApiError(err) || 'Courier approval update failed.';
      setActionError(msg);
      onError(msg);
    },
  });

  const cashLimitMutation = useMutation({
    mutationFn: (limit: number) => adminApi.updateRiderCashLimit(riderId as string, limit),
    onSuccess: () => {
      invalidateAll();
      setIsCashModalOpen(false);
      setActionError(null);
    },
    onError: (err) => {
      const msg = extractApiError(err) || 'Failed to update the cash safety limit.';
      setActionError(msg);
      onError(msg);
    },
  });

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const rider = detail?.rider;
  const stats = detail?.stats;
  const recentOrders = detail?.recentOrders ?? [];
  const recentDeposits = detail?.recentDeposits ?? [];

  return (
    <>
      <Drawer
        isOpen={!!riderId}
        onClose={onClose}
        title={
          rider ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-xs shadow-sm shrink-0">
                {getInitials(rider.fullName)}
              </div>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {rider.fullName}
                </h3>
                <Badge variant={STATUS_BADGE_VARIANT[detail?.status ?? 'OFFLINE'] ?? 'default'} size="sm">
                  {(detail?.status ?? 'OFFLINE').replace('_', ' ')}
                </Badge>
                {rider.isApproved ? (
                  <Badge variant="success" size="sm">
                    Approved
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    Pending Approval
                  </Badge>
                )}
                {rider.userStatus !== 'ACTIVE' && (
                  <Badge variant="danger" size="sm">
                    Suspended
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            'Courier Details'
          )
        }
        description={
          rider ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                {rider.phone}
              </span>
              <button
                type="button"
                onClick={() => handleCopyPhone(rider.phone)}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Copy phone number"
              >
                {copiedPhone ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
              {rider.email && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <a
                    href={`mailto:${rider.email}`}
                    className="flex items-center gap-1 truncate hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                    {rider.email}
                  </a>
                </>
              )}
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1 capitalize">
                <Bike className="h-3 w-3 text-slate-400" />
                {rider.vehicleType.toLowerCase()}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1 text-[11px]">
                <Calendar className="h-3 w-3 text-slate-400" />
                joined {formatDate(rider.joinedAt)}
              </span>
            </div>
          ) : undefined
        }
        action={
          rider ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Wallet className="h-3.5 w-3.5 shrink-0" />}
                className="text-xs h-8 cursor-pointer"
                onClick={() => setIsCashModalOpen(true)}
              >
                Cash Limit
              </Button>
              {rider.isApproved ? (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<ShieldOff className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 cursor-pointer whitespace-nowrap text-xs h-8"
                  onClick={() => setIsSuspendConfirmOpen(true)}
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 cursor-pointer whitespace-nowrap text-xs h-8"
                  isLoading={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate(true)}
                >
                  Approve
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {isLoading || !detail ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent mb-3" />
            <p>Loading courier profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {actionError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-between">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="font-semibold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Account Suspension / Inactive Warning Banner */}
            {(rider?.userStatus !== 'ACTIVE' || !rider?.isApproved) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                  <ShieldOff className="h-4 w-4 shrink-0" />
                  <span>{!rider?.isApproved ? 'Courier Pending Approval' : 'Courier Suspended'}</span>
                </div>
                <div className="mt-1 text-slate-700 dark:text-slate-300">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {!rider?.isApproved
                      ? 'Courier application has not yet been approved. Dispatch offers are paused.'
                      : 'Courier account is suspended and blocked from receiving dispatch orders.'}
                  </p>
                </div>
              </div>
            )}

            {/* Cash Safety Limit Warning Banner */}
            {rider?.cashSafetyWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Cash Safety Limit Warning</span>
                </div>
                <div className="mt-1 space-y-1 text-slate-700 dark:text-slate-300">
                  <p>
                    Cash in hand (<strong>{CURRENCY} {(rider?.cashInHand ?? 0).toLocaleString()}</strong>) exceeds or is
                    approaching the safety threshold of <strong>{CURRENCY} {(rider?.maxCashLimit ?? 0).toLocaleString()}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    COD reconciliation deposit is required before accepting additional high-value cash orders.
                  </p>
                </div>
              </div>
            )}

            {/* Active Trip / Order in Progress */}
            {detail.activeOrder && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedOrderId(detail.activeOrder!.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedOrderId(detail.activeOrder!.id);
                  }
                }}
                className="group rounded-xl border border-primary-200 bg-primary-50/40 p-3.5 hover:border-primary-400 hover:bg-primary-50/60 dark:border-primary-900 dark:bg-primary-950/20 dark:hover:border-primary-700 transition-all cursor-pointer shadow-sm select-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                      <Bike className="h-3.5 w-3.5 shrink-0" />
                      <span>Active Trip in Progress</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      {detail.activeOrder.orderNumber}
                      {detail.activeOrder.vendorName && ` · ${detail.activeOrder.vendorName}`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Click to view active order details</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <OrderStatusBadge status={detail.activeOrder.status} />
                    <Eye className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </div>
              </div>
            )}

            {/* Courier Metrics Grid (Synchronized 2x2 with Customer Details) */}
            <div className="grid grid-cols-2 gap-3">
              <DetailMetricCard
                label="Cash in Hand"
                icon={<Banknote className="h-3.5 w-3.5 text-amber-500" />}
                value={`${CURRENCY} ${(rider?.cashInHand ?? 0).toLocaleString()}`}
                valueClassName={rider?.cashSafetyWarning ? 'text-rose-600 dark:text-rose-400' : undefined}
                subtext={`limit ${CURRENCY} ${(rider?.maxCashLimit ?? 0).toLocaleString()}`}
              />

              <DetailMetricCard
                label="Deliveries"
                icon={<PackageCheck className="h-3.5 w-3.5 text-primary-500" />}
                value={(stats?.totalDeliveries ?? 0).toLocaleString()}
                subtext={`${stats?.totalTrips ?? 0} recorded trips`}
              />

              <DetailMetricCard
                label="Earnings (30d)"
                icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                value={`${CURRENCY} ${(stats?.earnings30d ?? 0).toLocaleString()}`}
                subtext={`lifetime ${CURRENCY} ${(stats?.lifetimeEarnings ?? 0).toLocaleString()}`}
              />

              <DetailMetricCard
                label="COD Collected"
                icon={<Receipt className="h-3.5 w-3.5 text-sky-500" />}
                value={`${CURRENCY} ${(stats?.lifetimeCodCollected ?? 0).toLocaleString()}`}
                subtext="lifetime courier collections"
              />
            </div>

            {/* Last known location / Telemetry strip */}
            {rider && (rider.lastSeenAt || (rider.latitude != null && rider.longitude != null)) && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Last seen {formatDateTime(rider.lastSeenAt)}</span>
                </div>
                {rider.latitude != null && rider.longitude != null && (
                  <div className="flex items-center gap-1 shrink-0">
                    <GoogleMapsLink
                      variant="icon"
                      latitude={rider.latitude}
                      longitude={rider.longitude}
                      title="Open courier last known location on Google Maps"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Recent Orders Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/60">
              {/* Section Header (Click to collapse/expand entire orders list) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsOrdersSectionOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsOrdersSectionOpen((prev) => !prev);
                  }
                }}
                className="flex items-center justify-between gap-2 px-3.5 py-3 bg-slate-50/80 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-transparent data-[open=true]:border-slate-200 dark:data-[open=true]:border-slate-800"
                data-open={isOrdersSectionOpen}
                aria-expanded={isOrdersSectionOpen}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingBag className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                    Recent Orders
                  </h4>
                  <Badge variant="default" size="sm" className="font-semibold text-[10px]">
                    {recentOrders.length}
                  </Badge>
                </div>

                <div
                  className={cn(
                    'p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform duration-200',
                    isOrdersSectionOpen ? 'rotate-0' : '-rotate-90'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>

              {/* Direct Orders List: clicking any order opens the unified Order Details popup */}
              {isOrdersSectionOpen && (
                <div className="p-3 space-y-2">
                  {recentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <ShoppingBag className="h-7 w-7 text-slate-300 dark:text-slate-600 mb-1.5" />
                      <p className="text-xs font-medium text-slate-500">No orders assigned yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Courier has not been dispatched for any orders yet.
                      </p>
                    </div>
                  ) : (
                    recentOrders.map((order) => (
                      <div
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrderId(order.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedOrderId(order.id);
                          }
                        }}
                        className="group w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-left hover:border-primary-400 hover:bg-primary-50/20 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-primary-600 dark:hover:bg-primary-950/20 transition-all cursor-pointer shadow-sm select-none"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {order.orderNumber}
                            </span>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                              {order.vendorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span>{formatDateTime(order.placedAt)}</span>
                            {order.paymentMethod && (
                              <>
                                <span>·</span>
                                <span>{formatPaymentMethod(order.paymentMethod)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {CURRENCY} {order.totalAmount.toLocaleString()}
                          </span>
                          <OrderStatusBadge status={order.status} />
                          <Eye className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Recent Cash Deposits Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/60">
              {/* Section Header (Click to collapse/expand entire deposits list) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsDepositsSectionOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsDepositsSectionOpen((prev) => !prev);
                  }
                }}
                className="flex items-center justify-between gap-2 px-3.5 py-3 bg-slate-50/80 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-transparent data-[open=true]:border-slate-200 dark:data-[open=true]:border-slate-800"
                data-open={isDepositsSectionOpen}
                aria-expanded={isDepositsSectionOpen}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                    Recent Cash Deposits
                  </h4>
                  <Badge variant="default" size="sm" className="font-semibold text-[10px]">
                    {recentDeposits.length}
                  </Badge>
                </div>

                <div
                  className={cn(
                    'p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform duration-200',
                    isDepositsSectionOpen ? 'rotate-0' : '-rotate-90'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>

              {/* Direct Deposits List */}
              {isDepositsSectionOpen && (
                <div className="p-3 space-y-2">
                  {recentDeposits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Banknote className="h-7 w-7 text-slate-300 dark:text-slate-600 mb-1.5" />
                      <p className="text-xs font-medium text-slate-500">No COD deposits recorded</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Courier has not submitted any cash reconciliation deposits yet.
                      </p>
                    </div>
                  ) : (
                    recentDeposits.map((deposit) => (
                      <div
                        key={deposit.id}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-left dark:border-slate-800 dark:bg-slate-900/40 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {CURRENCY} {deposit.amount.toLocaleString()}
                            </span>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                              Ref: {deposit.referenceNo}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {formatDateTime(deposit.depositedAt)}
                            </span>
                            {deposit.note && (
                              <>
                                <span>·</span>
                                <span className="truncate italic text-slate-500 dark:text-slate-400">
                                  "{deposit.note}"
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Badge
                            variant={
                              deposit.status === 'APPROVED'
                                ? 'success'
                                : deposit.status === 'PENDING_APPROVAL'
                                ? 'warning'
                                : 'danger'
                            }
                            size="sm"
                          >
                            {deposit.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Unified Order Details Popup Modal (sync with Customer Details) */}
      <OrderDetailsModal
        isOpen={!!selectedOrderId}
        order={selectedOrder ?? null}
        isLoading={isLoadingOrder}
        onClose={() => setSelectedOrderId(null)}
      />

      {/* Cash Limit Configuration Modal */}
      {rider && isCashModalOpen && (
        <CashLimitModal
          rider={{
            riderName: rider.fullName,
            maxCashLimit: rider.maxCashLimit,
            cashInHand: rider.cashInHand,
          }}
          isSubmitting={cashLimitMutation.isPending}
          onClose={() => setIsCashModalOpen(false)}
          onSubmit={(limit) => cashLimitMutation.mutate(limit)}
        />
      )}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendConfirmOpen}
        title="Suspend Courier?"
        variant="danger"
        confirmLabel="Suspend Courier"
        message={
          <>
            <p>
              Suspend <strong>{rider?.fullName}</strong>? The courier is forced off duty immediately and stops
              receiving dispatch offers.
            </p>
          </>
        }
        isPending={approvalMutation.isPending}
        onConfirm={() => approvalMutation.mutate(false)}
        onCancel={() => setIsSuspendConfirmOpen(false)}
      />
    </>
  );
};
