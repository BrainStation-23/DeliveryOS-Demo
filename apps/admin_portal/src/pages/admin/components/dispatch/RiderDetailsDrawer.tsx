import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, ExternalLink, PackageCheck, ShieldOff, ShieldCheck, Wallet } from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { Badge, OrderStatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Drawer } from '../../../../components/ui/Drawer';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { GoogleMapsLink } from '../../../../components/common/GoogleMapsLink';
import { CashLimitModal } from './CashLimitModal';

export interface RiderDetailsDrawerProps {
  riderId: string | null;
  onClose: () => void;
  onError: (message: string) => void;
}

const CURRENCY = '৳';

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'info' | 'default'> = {
  ONLINE: 'success',
  ON_TRIP: 'info',
  OFFLINE: 'default',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Unified courier details view: profile, cash state, lifetime performance,
 *  governance actions, recent orders (deep link into Order History), and the
 *  latest COD deposit trail. */
export const RiderDetailsDrawer: React.FC<RiderDetailsDrawerProps> = ({ riderId, onClose, onError }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCashModalOpen, setIsCashModalOpen] = React.useState(false);
  const [isSuspendConfirmOpen, setIsSuspendConfirmOpen] = React.useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-rider-detail', riderId],
    queryFn: () => adminApi.getRiderDetail(riderId as string),
    enabled: !!riderId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-rider-detail'] });
    queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
    queryClient.invalidateQueries({ queryKey: ['admin-riders'] });
  };

  const approvalMutation = useMutation({
    mutationFn: (isApproved: boolean) => adminApi.setRiderApproval(riderId as string, isApproved),
    onSuccess: () => {
      invalidateAll();
      setIsSuspendConfirmOpen(false);
    },
    onError: (err) => onError((err as Error)?.message || 'Courier approval update failed.'),
  });

  const cashLimitMutation = useMutation({
    mutationFn: (limit: number) => adminApi.updateRiderCashLimit(riderId as string, limit),
    onSuccess: () => {
      invalidateAll();
      setIsCashModalOpen(false);
    },
    onError: (err) => onError((err as Error)?.message || 'Failed to update the cash safety limit.'),
  });

  const rider = detail?.rider;
  const stats = detail?.stats;

  return (
    <>
      <Drawer
        isOpen={!!riderId}
        onClose={onClose}
        title={rider ? rider.fullName : 'Courier Details'}
        description={rider ? `${rider.phone} · ${rider.vehicleType}` : undefined}
      >
        {isLoading || !detail ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading courier profile...</div>
        ) : (
          <div className="space-y-6">
            {/* Profile + status */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <Badge variant={STATUS_BADGE_VARIANT[detail.status] ?? 'default'}>
                      {detail.status.replace('_', ' ')}
                    </Badge>
                    <span className="ml-2 text-xs text-slate-500">
                      joined {formatDateTime(rider?.joinedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {rider?.isApproved ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge variant="warning">Pending Approval</Badge>
                  )}
                  {rider && rider.userStatus !== 'ACTIVE' && <Badge variant="danger">Account Suspended</Badge>}
                </div>
              </div>
              {rider && (
                <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span>Last seen {formatDateTime(rider.lastSeenAt)}</span>
                  {rider.latitude != null && rider.longitude != null && (
                    <GoogleMapsLink
                      variant="icon"
                      latitude={rider.latitude}
                      longitude={rider.longitude}
                      title="Open rider last known location on Google Maps"
                    />
                  )}
                </p>
              )}
            </div>

            {/* Governance actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCashModalOpen(true)}
                leftIcon={<Wallet className="h-4 w-4" />}
              >
                Set Cash Limit
              </Button>
              {rider?.isApproved ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsSuspendConfirmOpen(true)}
                  leftIcon={<ShieldOff className="h-4 w-4" />}
                >
                  Suspend Courier
                </Button>
              ) : (
                <Button
                  variant="success"
                  size="sm"
                  isLoading={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate(true)}
                  leftIcon={<ShieldCheck className="h-4 w-4" />}
                >
                  Approve Courier
                </Button>
              )}
            </div>

            {/* Cash + performance stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Banknote className="h-3.5 w-3.5" /> Cash in Hand
                </div>
                <p
                  className={`mt-1 text-lg font-bold ${
                    rider?.cashSafetyWarning ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {CURRENCY} {(rider?.cashInHand ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">limit {CURRENCY} {(rider?.maxCashLimit ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <PackageCheck className="h-3.5 w-3.5" /> Deliveries
                </div>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {(stats?.totalDeliveries ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">{stats?.totalTrips ?? 0} recorded trips</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Earnings (30d)</div>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {CURRENCY} {(stats?.earnings30d ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">
                  lifetime {CURRENCY} {(stats?.lifetimeEarnings ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">COD Collected</div>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {CURRENCY} {(stats?.lifetimeCodCollected ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">lifetime</p>
              </div>
            </div>

            {/* Active order */}
            {detail.activeOrder && (
              <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4 dark:border-primary-900 dark:bg-primary-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                      Active Trip
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {detail.activeOrder.orderNumber} · {detail.activeOrder.vendorName}
                    </p>
                  </div>
                  <OrderStatusBadge status={detail.activeOrder.status} />
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recent Orders</h4>
              <div className="space-y-1.5">
                {detail.recentOrders.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">No orders assigned yet.</p>
                )}
                {detail.recentOrders.map((order) => (
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

            {/* Recent COD deposits */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recent Cash Deposits</h4>
              <div className="space-y-1.5">
                {detail.recentDeposits.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">No COD deposits recorded.</p>
                )}
                {detail.recentDeposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {CURRENCY} {deposit.amount.toLocaleString()} · {deposit.referenceNo}
                      </p>
                      <p className="text-[11px] text-slate-500">{formatDateTime(deposit.depositedAt)}</p>
                    </div>
                    <Badge
                      variant={
                        deposit.status === 'APPROVED'
                          ? 'success'
                          : deposit.status === 'PENDING_APPROVAL'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {deposit.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

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
