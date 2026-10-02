import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  Users,
  Store,
  DollarSign,
  Shuffle,
  RefreshCw,
} from 'lucide-react';
import adminApi, { AdminOverview } from '../../services/adminApi';
import { getSocket } from '../../services/socket';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { OrderDetailsModal } from '../../components/orders/OrderDetailsModal';
import { OrderListRow, OrdersTable } from './components/orders/OrdersTable';

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);

  const { data: overview, isLoading, isError, error, refetch } = useQuery<AdminOverview>({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverview,
    refetchInterval: 30000,
  });

  // Dashboard rows are the thin overview payload; the full detail view is
  // fetched by id the moment an admin opens one.
  const {
    data: detailsOrder,
    isLoading: isDetailsLoading,
  } = useQuery({
    queryKey: ['admin-order-detail', detailsOrderId],
    queryFn: () => adminApi.getOrderById(detailsOrderId as string),
    enabled: !!detailsOrderId,
  });

  useEffect(() => {
    const socket = getSocket();

    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-order-detail'] });
    };

    socket.on('order:new', handleOrderEvent);
    socket.on('order:status:changed', handleOrderEvent);

    return () => {
      socket.off('order:new', handleOrderEvent);
      socket.off('order:status:changed', handleOrderEvent);
    };
  }, [queryClient]);

  const metrics = overview?.metrics;
  const recentOrders: OrderListRow[] = (Array.isArray(overview?.recentOrders) ? overview.recentOrders : []).map(
    (order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      vendorName: order.outletName,
      customerName: order.customerName,
      riderName: order.riderName ?? null,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
    }),
  );

  const stats = [
    {
      title: t('admin.totalOrders'),
      value: metrics ? metrics.totalOrders.toLocaleString() : '0',
      icon: TrendingUp,
      change: metrics ? `${metrics.todayOrders} placed today` : '0 today',
      color: 'text-primary-600 bg-primary-50 dark:bg-primary-950/50',
    },
    {
      title: t('admin.activeRiders'),
      value: metrics ? metrics.activeRiders.toString() : '0',
      icon: Users,
      change: metrics ? `${metrics.ridersOnTrip} on delivery trip` : '0 active',
      color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50',
    },
    {
      title: t('admin.onlineVendors'),
      value: metrics ? `${metrics.onlineVendors} / ${metrics.totalVendors}` : '0 / 0',
      icon: Store,
      change: metrics && metrics.totalVendors > 0
        ? `${Math.round((metrics.onlineVendors / metrics.totalVendors) * 100)}% online`
        : '0% online',
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      title: t('admin.todayVolume'),
      value: metrics ? `৳ ${metrics.todayVolume.toLocaleString()}` : '৳ 0',
      icon: DollarSign,
      change: metrics ? `৳ ${metrics.todayCommission.toLocaleString()} commission` : '৳ 0 commission',
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Badge variant="purple" size="md">
              <Shuffle className="h-3 w-3 mr-1" />
              Dispatch: RIDER_FIRST
            </Badge>
          </>
        }
      />

      <Alert
        type="info"
        title="DeliveryOS Operational Readiness"
        message="Active multi-tenant cluster operating across Dhaka central zones. Redis Geospatial indexing and WebSocket tracking gateway active."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            subtitle={stat.change}
            icon={stat.icon}
            iconColorClass={stat.color}
            isLoading={isLoading}
          />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Recent Orders</h3>
          <span className="text-xs text-slate-500">Click an order for full details · auto-updates in real time</span>
        </div>

        {isError ? (
          <QueryErrorBanner error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900">
            <LoadingSpinner label="Loading live operational metrics..." />
          </div>
        ) : (
          <OrdersTable
            orders={recentOrders}
            emptyMessage="No orders recorded on the platform today yet."
            onViewDetails={(row) => setDetailsOrderId(row.id)}
          />
        )}
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
