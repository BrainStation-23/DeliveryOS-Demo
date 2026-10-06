import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Bike,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Percent,
  ShoppingBag,
  Store,
  TrendingUp,
  UserPlus,
  XCircle,
} from 'lucide-react';
import adminApi, { AnalyticsOverview } from '../../services/adminApi';
import { useSocketQueryInvalidation } from '../../hooks/useSocketSubscription';
import { DatePreset, resolveDateRange } from '../../utils/dateRange';
import { outletDisplayName } from '../../utils/outletDisplayName';
import { PageHeader } from '../../components/common/PageHeader';
import { DateRangeFilterToolbar } from '../../components/common/DateRangeFilterToolbar';
import { TrendStatCard } from '../../components/common/TrendStatCard';
import { StatCard } from '../../components/common/StatCard';
import { OrderDetailsModal } from '../../components/orders/OrderDetailsModal';
import { OrdersRevenueTrendChart } from '../../components/charts/OrdersRevenueTrendChart';
import { StatusDistributionDonut } from '../../components/charts/StatusDistributionDonut';
import { formatTrendData } from './components/dashboard/dashboardAnalytics';
import { OrderListRow, OrdersTable } from './components/orders/OrdersTable';

const CURRENCY = '৳';

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('LAST_7_DAYS');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { dateFromIso, dateToIso } = useMemo(
    () => resolveDateRange(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate],
  );

  const granularity: 'day' | 'hour' = datePreset === 'TODAY' || datePreset === 'YESTERDAY' ? 'hour' : 'day';

  const { data: analytics, isLoading, isError, error, refetch } = useQuery<AnalyticsOverview>({
    queryKey: ['admin-analytics', dateFromIso, dateToIso, granularity],
    queryFn: () => adminApi.getAnalyticsOverview({ dateFrom: dateFromIso, dateTo: dateToIso, granularity }),
    refetchInterval: 60000,
    placeholderData: (previous) => previous,
  });

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverview,
    refetchInterval: 30000,
  });

  useSocketQueryInvalidation(
    ['order:new', 'order:status:changed'],
    [['admin-analytics'], ['admin-overview']],
  );

  const {
    data: detailsOrder,
    isLoading: isDetailsLoading,
  } = useQuery({
    queryKey: ['admin-order-detail', detailsOrderId],
    queryFn: () => adminApi.getOrderById(detailsOrderId as string),
    enabled: !!detailsOrderId,
  });

  const cards = analytics?.cards;
  const snapshots = analytics?.snapshots;

  const trendData = useMemo(
    () => formatTrendData(analytics?.timeseries, granularity),
    [analytics?.timeseries, granularity],
  );

  const statusSlices = useMemo(
    () =>
      Object.entries(analytics?.statusCounts ?? {}).map(([status, count]) => ({ status, count })),
    [analytics?.statusCounts],
  );

  const recentOrders: OrderListRow[] = (overview?.recentOrders ?? []).map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    vendorName: order.outletName,
    customerName: order.customerName,
    riderName: order.riderName ?? null,
    status: order.status,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
  }));

  const money = (value: number | null | undefined): string =>
    value == null ? '—' : `${CURRENCY} ${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.admin.dashboard')}
        subtitle={t('admin.subtitle')}
        icon={LayoutDashboard}
      />

      <DateRangeFilterToolbar
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        customStartDate={customStartDate}
        onCustomStartDateChange={setCustomStartDate}
        customEndDate={customEndDate}
        onCustomEndDateChange={setCustomEndDate}
        onClearCustomDates={() => {
          setCustomStartDate('');
          setCustomEndDate('');
        }}
      />

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Failed to load analytics for this window: {(error as Error)?.message || 'unknown error'}
          <button onClick={() => refetch()} className="ml-2 font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Enriched metric cards with vs-previous-window trends */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TrendStatCard
          title="Total Orders"
          value={(cards?.totalOrders.value ?? 0).toLocaleString()}
          delta={cards?.totalOrders.delta ?? null}
          subtitle={`${cards?.deliveredOrders.value ?? 0} delivered`}
          icon={TrendingUp}
          iconColorClass="text-primary-600 bg-primary-50 dark:bg-primary-950/50 dark:text-primary-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Gross Volume"
          value={money(cards?.grossVolume.value)}
          delta={cards?.grossVolume.delta ?? null}
          icon={Banknote}
          iconColorClass="text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Platform Commission"
          value={money(cards?.commission.value)}
          delta={cards?.commission.delta ?? null}
          icon={Percent}
          iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Avg Order Value"
          value={money(cards?.avgOrderValue.value)}
          delta={cards?.avgOrderValue.delta ?? null}
          icon={ShoppingBag}
          iconColorClass="text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Delivered"
          value={(cards?.deliveredOrders.value ?? 0).toLocaleString()}
          delta={cards?.deliveredOrders.delta ?? null}
          icon={CheckCircle2}
          iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Cancellation Rate"
          value={`${cards?.cancellationRate.value ?? 0}%`}
          delta={cards?.cancellationRate.delta ?? null}
          deltaInverted
          subtitle={`${cards?.cancelledOrders.value ?? 0} cancelled`}
          icon={XCircle}
          iconColorClass="text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="Avg Delivery Time"
          value={cards?.avgDeliveryMinutes.value != null ? `${cards.avgDeliveryMinutes.value} min` : '—'}
          delta={cards?.avgDeliveryMinutes.delta ?? null}
          deltaInverted
          icon={Clock}
          iconColorClass="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400"
          isLoading={isLoading}
        />
        <TrendStatCard
          title="New Customers"
          value={(cards?.newCustomers.value ?? 0).toLocaleString()}
          delta={cards?.newCustomers.delta ?? null}
          icon={UserPlus}
          iconColorClass="text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400"
          isLoading={isLoading}
        />
      </div>

      {/* Live operational snapshots (not window-scoped) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Active Outlets"
          value={(snapshots?.activeOutlets ?? 0).toLocaleString()}
          subtitle="Outlets currently accepting orders platform-wide"
          icon={<Store className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Couriers Online"
          value={(snapshots?.onlineRiders ?? 0).toLocaleString()}
          subtitle={`${overview?.metrics.ridersOnTrip ?? 0} currently on delivery trips`}
          icon={<Bike className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconColorClass="text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400"
          isLoading={isLoading}
        />
      </div>

      {/* Trend chart + status mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Orders & Gross Volume Trend</h3>
            <span className="text-xs text-slate-400">{granularity === 'hour' ? 'Hourly' : 'Daily'} buckets</span>
          </div>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
          ) : (
            <OrdersRevenueTrendChart data={trendData} />
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Order Status Mix</h3>
          <StatusDistributionDonut data={statusSlices} />
        </div>
      </div>

      {/* Top performers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Most Ordered Outlets</h3>
          </div>
          <div className="space-y-2">
            {(analytics?.topOutlets ?? []).length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No outlet orders in this window.</p>
            )}
            {(analytics?.topOutlets ?? []).map((outlet, index) => (
              <div
                key={outlet.vendorId}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{outletDisplayName(outlet.brandName, outlet.vendorName)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{outlet.orders} orders</p>
                  <p className="text-[11px] text-slate-500">{money(outlet.grossVolume)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Performing Couriers</h3>
          </div>
          <div className="space-y-2">
            {(analytics?.topRiders ?? []).length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No courier trips in this window.</p>
            )}
            {(analytics?.topRiders ?? []).map((rider, index) => (
              <div
                key={rider.riderId}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{rider.riderName}</p>
                  <p className="truncate text-[11px] text-slate-500">{rider.phone || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{rider.trips} trips</p>
                  <p className="text-[11px] text-slate-500">{money(rider.earnings)} earned</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent live orders */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Recent Orders</h3>
          <span className="text-xs text-slate-500">
            Live feed across all outlets · click an order for the unified details view
          </span>
        </div>
        <OrdersTable
          orders={recentOrders}
          emptyMessage="No orders recorded on the platform yet."
          onViewDetails={(row) => setDetailsOrderId(row.id)}
        />
      </div>

      <OrderDetailsModal
        isOpen={!!detailsOrderId}
        order={detailsOrder || null}
        isLoading={isDetailsLoading}
        onClose={() => setDetailsOrderId(null)}
      />
    </div>
  );
};

