import React, { useMemo, useState } from 'react';
import { Pencil, Tag, Plus, Trash2 } from 'lucide-react';
import { AdminCoupon } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Table, Column } from '../../../../components/ui/Table';
import { EmptyState } from '../../../../components/common/EmptyState';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';
import { formatCurrency } from '../../../../utils/formatters';

interface CouponTableProps {
  coupons: AdminCoupon[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onToggle: (coupon: AdminCoupon) => void;
  onEdit: (coupon: AdminCoupon) => void;
  onDelete: (coupon: AdminCoupon) => void;
  onAdd: () => void;
}

const PAGE_SIZE = 10;

export const CouponTable: React.FC<CouponTableProps> = ({
  coupons,
  isLoading,
  error,
  onRetry,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const [page, setPage] = useState(1);

  const safeCoupons = Array.isArray(coupons) ? coupons : [];
  const totalPages = Math.max(1, Math.ceil(safeCoupons.length / PAGE_SIZE));
  const paginatedCoupons = useMemo(() => {
    return safeCoupons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [safeCoupons, page]);

  if (error) {
    return <QueryErrorBanner error={error} onRetry={onRetry} />;
  }

  if (!isLoading && safeCoupons.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="No coupon codes"
        message="No promo coupon codes created yet. Create codes like WELCOME50 for customers."
        action={
          <Button size="sm" onClick={onAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Create Coupon
          </Button>
        }
        className="m-4"
      />
    );
  }

  const columns: Column<AdminCoupon>[] = [
    {
      key: 'code',
      header: 'Promo Code',
      render: (coupon) => (
        <div>
          <span className="font-bold tracking-wider text-slate-900 dark:text-slate-100">
            {coupon.code}
          </span>
          {coupon.description && (
            <div className="text-[11px] font-normal text-slate-500">{coupon.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Discount Rule',
      render: (coupon) => (
        <span className="font-semibold text-primary-600 dark:text-primary-400">
          {coupon.discountType === 'PERCENTAGE'
            ? `${coupon.discountValue}% OFF`
            : `${formatCurrency(coupon.discountValue)} FLAT`}
        </span>
      ),
    },
    {
      key: 'minOrderAmount',
      header: 'Min Spend',
      render: (coupon) => formatCurrency(coupon.minOrderAmount),
    },
    {
      key: 'maxDiscountAmount',
      header: 'Max Cap',
      render: (coupon) =>
        coupon.maxDiscountAmount ? formatCurrency(coupon.maxDiscountAmount) : 'No Cap',
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (coupon) => (
        <span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{coupon.currentUses}</span>
          <span className="text-slate-400"> / {coupon.usageLimit}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (coupon) => (
        coupon.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="default">Paused</Badge>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (coupon) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => onToggle(coupon)}
          >
            {coupon.isActive ? 'Pause' : 'Activate'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
            onClick={() => onEdit(coupon)}
            leftIcon={<Pencil className="h-3.5 w-3.5" />}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
            onClick={() => onDelete(coupon)}
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={paginatedCoupons}
      keyExtractor={(c) => c.id}
      isLoading={isLoading}
      emptyMessage="No coupons match the search query."
      page={page}
      totalPages={totalPages}
      totalItems={safeCoupons.length}
      onPageChange={setPage}
    />
  );
};
