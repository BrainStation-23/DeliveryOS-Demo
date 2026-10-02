import React from 'react';
import { UserCheck, XCircle, Bike } from 'lucide-react';
import { Table, Column } from '../../../../components/ui/Table';
import { OrderStatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { formatCurrency } from '../../../../utils/formatters';

/**
 * The minimal row every order list surface (dashboard + order history)
 * renders. Details live behind a click — never extra columns.
 */
export interface OrderListRow {
  id: string;
  orderNumber: string;
  placedAt: string;
  vendorName: string;
  customerName: string;
  riderName: string | null;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  riderId?: string | null;
}

interface OrdersTableProps {
  orders: OrderListRow[];
  onViewDetails: (row: OrderListRow) => void;
  /** Operational actions render only where provided (order history, not dashboard). */
  onAssign?: (row: OrderListRow) => void;
  onCancel?: (row: OrderListRow) => void;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

const isTerminal = (status: string) => status === 'DELIVERED' || status === 'CANCELLED';

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  onViewDetails,
  onAssign,
  onCancel,
  emptyMessage = 'No orders to show.',
  page,
  totalPages,
  totalItems,
  onPageChange,
}) => {
  const hasActions = Boolean(onAssign || onCancel);

  const columns: Column<OrderListRow>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (order) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(order);
            }}
            className="font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 text-left cursor-pointer"
            title="Click to view order details"
          >
            {order.orderNumber}
          </button>
          <div className="text-[11px] text-slate-500">
            {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Outlet',
      render: (order) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">{order.vendorName}</div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (order) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">{order.customerName}</div>
      ),
    },
    {
      key: 'riderName',
      header: 'Courier',
      render: (order) =>
        order.riderName ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Bike className="h-3.5 w-3.5 text-primary-600 shrink-0" />
            <span className="font-medium">{order.riderName}</span>
          </div>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px] italic">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (order) => (
        <div className="text-right">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(order.totalAmount)}</span>
          <div className="text-[10px] text-slate-400">{order.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Online'}</div>
        </div>
      ),
    },
  ];

  if (hasActions) {
    columns.push({
      key: 'id',
      header: 'Action',
      render: (order) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          {!isTerminal(order.status) ? (
            <>
              {onAssign && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(order);
                  }}
                  leftIcon={<UserCheck className="h-3.5 w-3.5 text-primary-600" />}
                >
                  {order.riderId ? 'Reassign' : 'Assign'}
                </Button>
              )}
              {onCancel && order.status !== 'DISPATCHED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(order);
                  }}
                  leftIcon={<XCircle className="h-3.5 w-3.5 text-rose-500" />}
                >
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </div>
      ),
    });
  }

  return (
    <Table
      data={orders}
      columns={columns}
      keyExtractor={(o) => o.id}
      emptyMessage={emptyMessage}
      onRowClick={onViewDetails}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onPageChange={onPageChange}
    />
  );
};
