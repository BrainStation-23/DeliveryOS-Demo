import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import { useKDSOrders } from '../../hooks/useKDSOrders';
import { KDSOrderCard } from '../../components/kds/KDSOrderCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { cn } from '../../utils/cn';

export const VendorDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useVendorOutlet();
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');

  const targetVendorId =
    activeOutletId && activeOutletId !== 'ALL'
      ? activeOutletId
      : user?.vendorId || undefined;

  const {
    isLoading,
    isError,
    refetch,
    isSocketConnected,
    actionError,
    dismissActionError,
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
    <div className="space-y-4 sm:space-y-5">
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span className="truncate">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={dismissActionError}
            className="h-7 px-2.5 inline-flex items-center justify-center rounded-md border border-red-300/80 bg-white/90 text-xs font-bold text-red-700 hover:bg-white hover:text-red-900 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60 transition-colors shadow-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {(!isSocketConnected || isError) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
            <span className="truncate">
              {isError
                ? 'Order board connection interrupted — displaying last synced state.'
                : 'Reconnecting live updates...'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-7 px-2.5 inline-flex items-center justify-center rounded-md border border-amber-300/80 bg-white/90 text-xs font-bold text-amber-700 hover:bg-white hover:text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-xs shrink-0"
          >
            Retry now
          </button>
        </div>
      )}

      <PageHeader
        title={t('kds.title')}
        description={`${outletDisplayName} • Real-time kitchen dispatch board`}
        badge={
          <Badge variant="primary" size="md">
            {totalActive} Active Orders
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {/* Mobile Lane Selector Tabs */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'ALL', label: 'All Lanes', count: totalActive },
          { key: 'NEW', label: t('kds.newOrders'), count: newOrders.length },
          { key: 'PREPARING', label: t('kds.preparing'), count: inPreparationOrders.length },
          { key: 'READY', label: t('kds.ready'), count: readyOrders.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all h-8 whitespace-nowrap select-none shrink-0',
              activeTab === tab.key
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                activeTab === tab.key
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" label="Synchronizing kitchen board..." />
        </div>
      ) : (
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory pb-4">
          {/* LANE 1: NEW ORDERS */}
          <div
            className={cn(
              'flex flex-col rounded-xl border border-rose-200/80 bg-rose-50/25 p-3.5 dark:border-rose-950/60 dark:bg-rose-950/10 shadow-xs shrink-0 md:shrink w-[88vw] sm:w-[350px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'NEW' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {newOrders.length > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <h3 className="font-bold text-xs sm:text-sm text-rose-950 dark:text-rose-200">
                  {t('kds.newOrders')}
                </h3>
              </div>
              <Badge variant="danger" size="sm" className="font-bold">
                {newOrders.length}
              </Badge>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100dvh-230px)] pr-1">
              {newOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mb-2 text-rose-500">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No incoming orders</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Chime alerts will sound upon customer order</span>
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
              'flex flex-col rounded-xl border border-amber-200/80 bg-amber-50/25 p-3.5 dark:border-amber-950/60 dark:bg-amber-950/10 shadow-xs shrink-0 md:shrink w-[88vw] sm:w-[350px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'PREPARING' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                  {t('kds.preparing')}
                </h3>
              </div>
              <Badge variant="warning" size="sm" className="font-bold">
                {inPreparationOrders.length}
              </Badge>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100dvh-230px)] pr-1">
              {inPreparationOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-2 text-amber-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kitchen queue is clear</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Accepted orders move here</span>
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
              'flex flex-col rounded-xl border border-emerald-200/80 bg-emerald-50/25 p-3.5 dark:border-emerald-950/60 dark:bg-emerald-950/10 shadow-xs shrink-0 md:shrink w-[88vw] sm:w-[350px] md:w-auto snap-center',
              activeTab !== 'ALL' && activeTab !== 'READY' && 'hidden md:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                  {t('kds.ready')}
                </h3>
              </div>
              <Badge variant="success" size="sm" className="font-bold">
                {readyOrders.length}
              </Badge>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100dvh-230px)] pr-1">
              {readyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Counter is clear</p>
                  <span className="text-[11px] text-slate-400 mt-0.5">Parcels awaiting couriers appear here</span>
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
