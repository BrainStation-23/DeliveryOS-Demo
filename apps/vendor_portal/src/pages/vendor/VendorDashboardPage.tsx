import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  RefreshCw,
  Bell,
  Sparkles,
  Flame,
  PauseCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import { useKDSOrders } from '../../hooks/useKDSOrders';
import { KDSOrderCard } from '../../components/kds/KDSOrderCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { soundEngine } from '../../utils/sound';
import kdsApi from '../../services/kdsApi';
import { cn } from '../../utils/cn';

export const VendorDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, refetchOutlets } = useVendorOutlet();
  const [isTogglingRush, setIsTogglingRush] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');

  const toggleRushPause = async () => {
    if (!activeOutlet || activeOutlet.id === 'ALL' || isTogglingRush) return;
    try {
      setIsTogglingRush(true);
      await kdsApi.updateOutletSettings(activeOutlet.id, {
        isBusy: !activeOutlet.isBusy,
      });
      await refetchOutlets();
    } catch (err) {
      console.error('Failed to toggle rush pause:', err);
    } finally {
      setIsTogglingRush(false);
    }
  };

  const targetVendorId =
    activeOutletId && activeOutletId !== 'ALL'
      ? activeOutletId
      : user?.vendorId || undefined;

  const {
    isLoading,
    isError,
    error,
    refetch,
    isSocketConnected,
    newOrders,
    inPreparationOrders,
    readyOrders,
    acceptOrder,
    rejectOrder,
    markOrderReady,
    handoverOrder,
    isAccepting,
    isRejecting,
    isMarkingReady,
    isHandingOver,
  } = useKDSOrders(targetVendorId);

  const totalActive = newOrders.length + inPreparationOrders.length + readyOrders.length;
  const outletDisplayName = activeOutlet?.name || user?.vendorName || 'Consolidated Kitchen Operations';

  return (
    <div className="space-y-5">
      {(!isSocketConnected || isError) && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
          {isError
            ? 'Order board failed to load — showing the last known state. '
            : 'Live connection lost — new-order alerts are paused. '}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
          >
            Retry now
          </button>
          {!isSocketConnected && !isError && (
            <span className="font-normal">Polling every 15s in the meantime.</span>
          )}
        </div>
      )}
      <PageHeader
        title={t('kds.title')}
        description={`${outletDisplayName} • Real-time kitchen order board & preparation dispatcher`}
        badge={
          <Badge variant="purple" size="md">
            {totalActive} Active
          </Badge>
        }
        actions={
          <>
            {activeOutlet && activeOutlet.id !== 'ALL' && (
              <Button
                variant={activeOutlet.isBusy ? 'danger' : 'outline'}
                size="sm"
                onClick={toggleRushPause}
                isLoading={isTogglingRush}
                className="min-h-[40px] text-xs font-bold"
                leftIcon={
                  activeOutlet.isBusy ? (
                    <Flame className="h-4 w-4 text-white animate-pulse" />
                  ) : (
                    <PauseCircle className="h-4 w-4 text-amber-500" />
                  )
                }
              >
                {activeOutlet.isBusy ? 'Rush Paused (Resume)' : 'Rush Pause'}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => soundEngine.playChime()}
              className="min-h-[40px] text-xs font-semibold"
              leftIcon={<Bell className="h-4 w-4 text-amber-500" />}
            >
              Test Chime
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="min-h-[40px] text-xs font-semibold"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              {t('common.refresh')}
            </Button>
          </>
        }
      />

      {/* Mobile Lane Selector Tabs */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { key: 'ALL', label: 'All Lanes', count: totalActive },
          { key: 'NEW', label: t('kds.newOrders'), count: newOrders.length, badgeVariant: 'danger' as const },
          { key: 'PREPARING', label: t('kds.preparing'), count: inPreparationOrders.length, badgeVariant: 'warning' as const },
          { key: 'READY', label: t('kds.ready'), count: readyOrders.length, badgeVariant: 'success' as const },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all min-h-[40px] whitespace-nowrap select-none',
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-extrabold',
                activeTab === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" label="Synchronizing kitchen board..." />
        </div>
      ) : (
        <div className="flex md:grid md:grid-cols-3 gap-5 overflow-x-auto snap-x snap-mandatory pb-4">
          {/* LANE 1: NEW ORDERS */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border border-rose-200 bg-rose-50/20 p-4 dark:border-rose-950/60 dark:bg-rose-950/10 shadow-sm shrink-0 md:shrink w-[88vw] sm:w-[360px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'NEW' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-rose-200/80 pb-3 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {newOrders.length > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <h3 className="font-extrabold text-base text-rose-950 dark:text-rose-200">
                  {t('kds.newOrders')}
                </h3>
              </div>
              <Badge variant="danger" size="md" className="font-extrabold">
                {newOrders.length}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {newOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mb-2.5 text-rose-500">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No incoming orders</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Chime will sound when customer orders</span>
                </div>
              ) : (
                newOrders.map((order) => (
                  <KDSOrderCard
                    key={order.id}
                    order={order}
                    onAccept={acceptOrder}
                    onReject={rejectOrder}
                    isActionLoading={isAccepting}
                    isRejecting={isRejecting}
                  />
                ))
              )}
            </div>
          </div>

          {/* LANE 2: IN PREPARATION */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border border-amber-200 bg-amber-50/20 p-4 dark:border-amber-950/60 dark:bg-amber-950/10 shadow-sm shrink-0 md:shrink w-[88vw] sm:w-[360px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'PREPARING' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-extrabold text-base text-amber-950 dark:text-amber-200">
                  {t('kds.preparing')}
                </h3>
              </div>
              <Badge variant="warning" size="md" className="font-extrabold">
                {inPreparationOrders.length}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {inPreparationOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-2.5 text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Kitchen queue is clear</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Accepted orders will appear here</span>
                </div>
              ) : (
                inPreparationOrders.map((order) => (
                  <KDSOrderCard
                    key={order.id}
                    order={order}
                    onMarkReady={markOrderReady}
                    isActionLoading={isMarkingReady}
                  />
                ))
              )}
            </div>
          </div>

          {/* LANE 3: READY FOR PICKUP */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 dark:border-emerald-950/60 dark:bg-emerald-950/10 shadow-sm shrink-0 md:shrink w-[88vw] sm:w-[360px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'READY' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-emerald-950 dark:text-emerald-200">
                  {t('kds.ready')}
                </h3>
              </div>
              <Badge variant="success" size="md" className="font-extrabold">
                {readyOrders.length}
              </Badge>
            </div>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {readyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-2.5 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Counter is clear</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Packaged parcels awaiting riders appear here</span>
                </div>
              ) : (
                readyOrders.map((order) => (
                  <KDSOrderCard
                    key={order.id}
                    order={order}
                    onHandover={handoverOrder}
                    isActionLoading={isHandingOver}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
