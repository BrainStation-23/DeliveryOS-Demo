import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  ClipboardList,
  Clock,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { outletLabel } from '../../utils/outletDisplayName';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import { useKDSOrders } from '../../hooks/useKDSOrders';
import { KDSOrderCard } from '../../components/kds/KDSOrderCard';
import { KDSLaneColumn } from '../../components/kds/KDSLaneColumn';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { cn } from '../../utils/cn';
import kdsApi from '../../services/kdsApi';
import { SalesLedgerDetailModal } from './components/SalesLedgerDetailModal';

export const VendorDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useVendorOutlet();
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);

  // Unified order details: fetched on demand when the card's info icon opens.
  const { data: detailOrder, isLoading: isDetailLoading } = useQuery({
    queryKey: ['vendor-order-detail', detailsOrderId],
    queryFn: () => kdsApi.getOrderDetail(detailsOrderId as string),
    enabled: !!detailsOrderId,
  });

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
  const headerOutletName = activeOutlet
    ? outletLabel(activeOutlet)
    : user?.vendorName
      ? outletLabel({ name: user.vendorName, brandName: user.brandName })
      : t('kds.title');

  return (
    <div className="space-y-4 sm:space-y-5">
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
            <span className="truncate">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={dismissActionError}
            className="h-7 px-2.5 inline-flex items-center justify-center rounded-md border border-rose-300/80 bg-white/90 text-xs font-bold text-rose-700 hover:bg-white hover:text-rose-900 dark:border-rose-800/80 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            {t('kds.dismiss')}
          </button>
        </div>
      )}

      {(!isSocketConnected || isError) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
            <span className="truncate">
              {isError
                ? t('kds.connectionInterrupted')
                : t('kds.reconnecting')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-7 px-2.5 inline-flex items-center justify-center rounded-md border border-amber-300/80 bg-white/90 text-xs font-bold text-amber-700 hover:bg-white hover:text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            {t('kds.retryNow')}
          </button>
        </div>
      )}

      <PageHeader
        title={t('kds.title')}
        description={`${headerOutletName} • ${t('kds.subtitle')}`}
        icon={<ClipboardList className="h-5 w-5 text-amber-500" />}
        badge={
          <Badge variant="primary" size="md">
            {t('kds.activeOrders', { count: totalActive })}
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
          { key: 'ALL', label: t('kds.allLanes'), count: totalActive },
          { key: 'NEW', label: t('kds.newOrders'), count: newOrders.length },
          { key: 'PREPARING', label: t('kds.preparing'), count: inPreparationOrders.length },
          { key: 'READY', label: t('kds.ready'), count: readyOrders.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all h-8 whitespace-nowrap select-none shrink-0 cursor-pointer',
              activeTab === tab.key
                ? 'bg-amber-500 text-white shadow-sm'
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
          <LoadingSpinner size="lg" label={t('common.loading')} />
        </div>
      ) : (
        <div className="flex md:grid md:grid-cols-3 gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-3">
          {/* LANE 1: NEW ORDERS */}
          <KDSLaneColumn
            title={t('kds.newOrders')}
            count={newOrders.length}
            colorVariant="rose"
            badgeVariant="danger"
            hasPing
            emptyIcon={<Sparkles className="h-5 w-5" />}
            emptyTitle={t('kds.noIncomingOrders')}
            emptySubtitle={t('kds.noIncomingOrdersSub')}
            isVisibleOnMobile={activeTab === 'ALL' || activeTab === 'NEW'}
          >
            {newOrders.map((order) => (
              <KDSOrderCard
                key={order.id}
                order={order}
                onAccept={acceptOrder}
                onReject={rejectOrder}
                onOpenDetails={setDetailsOrderId}
                isActionLoading={isAccepting}
                isRejecting={isRejecting}
              />
            ))}
          </KDSLaneColumn>

          {/* LANE 2: IN PREPARATION */}
          <KDSLaneColumn
            title={t('kds.preparing')}
            count={inPreparationOrders.length}
            colorVariant="amber"
            badgeVariant="warning"
            headerIcon={<ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            emptyIcon={<Clock className="h-5 w-5" />}
            emptyTitle={t('kds.kitchenQueueClear')}
            emptySubtitle={t('kds.kitchenQueueClearSub')}
            isVisibleOnMobile={activeTab === 'ALL' || activeTab === 'PREPARING'}
          >
            {inPreparationOrders.map((order) => (
              <KDSOrderCard
                key={order.id}
                order={order}
                onMarkReady={markOrderReady}
                onOpenDetails={setDetailsOrderId}
                isActionLoading={isMarkingReady}
              />
            ))}
          </KDSLaneColumn>

          {/* LANE 3: READY FOR PICKUP */}
          <KDSLaneColumn
            title={t('kds.ready')}
            count={readyOrders.length}
            colorVariant="emerald"
            badgeVariant="success"
            headerIcon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            emptyIcon={<CheckCircle2 className="h-5 w-5" />}
            emptyTitle={t('kds.counterClear')}
            emptySubtitle={t('kds.counterClearSub')}
            isVisibleOnMobile={activeTab === 'ALL' || activeTab === 'READY'}
          >
            {readyOrders.map((order) => (
              <KDSOrderCard
                key={order.id}
                order={order}
                onHandover={handoverOrder}
                onOpenDetails={setDetailsOrderId}
                isActionLoading={isHandingOver}
              />
            ))}
          </KDSLaneColumn>
        </div>
      )}

      <SalesLedgerDetailModal
        order={detailOrder || null}
        onClose={() => setDetailsOrderId(null)}
      />
      {detailsOrderId && isDetailLoading && null}
    </div>
  );
};
