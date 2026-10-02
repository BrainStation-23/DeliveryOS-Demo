import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Tag, Plus } from 'lucide-react';
import adminApi, { AdminBanner, AdminCoupon } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchInput } from '../../components/common/SearchInput';
import { PageHeader } from '../../components/common/PageHeader';
import { extractApiError } from '../../utils/apiError';
import { BannerGrid } from './components/promotions/BannerGrid';
import { CouponTable } from './components/promotions/CouponTable';
import { BannerFormModal } from './components/promotions/BannerFormModal';
import { CouponFormModal } from './components/promotions/CouponFormModal';

type PromotionsTab = 'BANNERS' | 'COUPONS';

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

/** Filters banners by title or deeplink target (client-side; pilot-scale lists). */
export function filterBannersByQuery(banners: AdminBanner[], query: string): AdminBanner[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return banners;
  return banners.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.linkType.toLowerCase().includes(q) ||
      (b.targetUrl || '').toLowerCase().includes(q),
  );
}

/** Filters coupons by code or description (client-side; pilot-scale lists). */
export function filterCouponsByQuery(coupons: AdminCoupon[], query: string): AdminCoupon[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return coupons;
  return coupons.filter(
    (c) => c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q),
  );
}

export const AdminPromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PromotionsTab>('BANNERS');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [bannerSearch, setBannerSearch] = useState('');
  const [couponSearch, setCouponSearch] = useState('');
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);

  const {
    data: banners = [],
    isLoading: isLoadingBanners,
    error: bannersError,
    refetch: refetchBanners,
  } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: adminApi.getBanners,
  });

  const {
    data: coupons = [],
    isLoading: isLoadingCoupons,
    error: couponsError,
    refetch: refetchCoupons,
  } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: adminApi.getCoupons,
  });

  const safeBanners = useMemo(() => filterBannersByQuery(banners, bannerSearch), [banners, bannerSearch]);
  const safeCoupons = useMemo(() => filterCouponsByQuery(coupons, couponSearch), [coupons, couponSearch]);

  const createOrUpdateBannerMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Parameters<typeof adminApi.createBanner>[0] }) =>
      id ? adminApi.updateBanner(id, payload) : adminApi.createBanner(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setBannerFormOpen(false);
      setEditingBanner(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to save promotional banner.')),
  });

  const toggleBannerMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateBanner(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: (err) => setActionError(extractApiError(err, 'Failed to update banner status.')),
  });

  const deleteBannerMutation = useMutation({
    mutationFn: adminApi.deleteBanner,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete promotional banner.')),
  });

  const createOrUpdateCouponMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<AdminCoupon> }) =>
      id ? adminApi.updateCoupon(id, payload) : adminApi.createCoupon(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setCouponFormOpen(false);
      setEditingCoupon(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to save coupon.')),
  });

  const toggleCouponMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateCoupon(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: (err) => setActionError(extractApiError(err, 'Failed to update coupon status.')),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: adminApi.deleteCoupon,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete coupon code.')),
  });

  const toggleBanner = (banner: AdminBanner) =>
    toggleBannerMutation.mutate({ id: banner.id, isActive: !banner.isActive });

  const toggleCoupon = (coupon: AdminCoupon) =>
    toggleCouponMutation.mutate({ id: coupon.id, isActive: !coupon.isActive });

  const requestBannerDelete = (banner: AdminBanner) =>
    setConfirmState({
      title: 'Delete Promotional Banner',
      message: `Delete the banner "${banner.title}"? The customer app stops showing it immediately.`,
      onConfirm: () => deleteBannerMutation.mutate(banner.id),
    });

  const requestCouponDelete = (coupon: AdminCoupon) =>
    setConfirmState({
      title: 'Delete Coupon Code',
      message: `Delete coupon code ${coupon.code}? Customers can no longer apply it at checkout.`,
      onConfirm: () => deleteCouponMutation.mutate(coupon.id),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Coupon Engine"
        subtitle="Manage home screen hero banners with tap deeplinks and checkout discount coupon campaigns"
        icon={Tag}
        actions={
          activeTab === 'BANNERS' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingBanner(null);
                setBannerFormOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Promotional Banner
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setEditingCoupon(null);
                setCouponFormOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Promo Code
            </Button>
          )
        }
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />
      )}

      <Tabs
        aria-label="Promotions sections"
        items={[
          { id: 'BANNERS', label: 'Banners', icon: <ImageIcon className="h-4 w-4" />, count: banners.length },
          { id: 'COUPONS', label: 'Coupons', icon: <Tag className="h-4 w-4" />, count: coupons.length },
        ]}
        selected={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'BANNERS' && (
        <div className="space-y-4">
          <SearchInput
            value={bannerSearch}
            onChange={setBannerSearch}
            placeholder="Search banners by title, link type, or URL..."
          />
          <BannerGrid
            banners={safeBanners}
            isLoading={isLoadingBanners}
            error={bannersError}
            onRetry={() => refetchBanners()}
            onToggle={toggleBanner}
            onEdit={(banner) => {
              setEditingBanner(banner);
              setBannerFormOpen(true);
            }}
            onDelete={requestBannerDelete}
            onAdd={() => setBannerFormOpen(true)}
          />
        </div>
      )}

      {activeTab === 'COUPONS' && (
        <div className="space-y-4">
          <SearchInput
            value={couponSearch}
            onChange={setCouponSearch}
            placeholder="Search coupons by code or description..."
          />
          <CouponTable
            coupons={safeCoupons}
            isLoading={isLoadingCoupons}
            error={couponsError}
            onRetry={() => refetchCoupons()}
            onToggle={toggleCoupon}
            onEdit={(coupon) => {
              setEditingCoupon(coupon);
              setCouponFormOpen(true);
            }}
            onDelete={requestCouponDelete}
            onAdd={() => setCouponFormOpen(true)}
          />
        </div>
      )}

      <BannerFormModal
        isOpen={bannerFormOpen}
        isSubmitting={createOrUpdateBannerMutation.isPending}
        editing={editingBanner}
        onClose={() => {
          setBannerFormOpen(false);
          setEditingBanner(null);
        }}
        onSubmit={(payload) =>
          createOrUpdateBannerMutation.mutate({
            id: editingBanner?.id,
            payload: editingBanner ? payload : { ...payload, isActive: true },
          })
        }
      />

      <CouponFormModal
        isOpen={couponFormOpen}
        isSubmitting={createOrUpdateCouponMutation.isPending}
        editing={editingCoupon}
        onClose={() => {
          setCouponFormOpen(false);
          setEditingCoupon(null);
        }}
        onSubmit={(payload) =>
          createOrUpdateCouponMutation.mutate({
            id: editingCoupon?.id,
            payload: editingCoupon ? payload : { ...payload, isActive: true },
          })
        }
      />

      <Modal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title || ''}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setConfirmState(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                confirmState?.onConfirm();
                setConfirmState(null);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{confirmState?.message}</p>
      </Modal>
    </div>
  );
};
