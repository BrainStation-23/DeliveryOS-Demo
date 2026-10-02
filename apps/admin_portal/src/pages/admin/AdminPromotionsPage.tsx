import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus } from 'lucide-react';
import adminApi, { AdminBanner, AdminCoupon } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { extractApiError } from '../../utils/apiError';
import { PromotionsTabBar, PromotionsTab } from './components/promotions/PromotionsTabBar';
import { BannerGrid } from './components/promotions/BannerGrid';
import { CouponTable } from './components/promotions/CouponTable';
import { BannerFormModal } from './components/promotions/BannerFormModal';
import { CouponFormModal } from './components/promotions/CouponFormModal';
import { ConfirmDeleteModal } from './components/promotions/ConfirmDeleteModal';

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

export const AdminPromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PromotionsTab>('BANNERS');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [isCreateBannerModalOpen, setIsCreateBannerModalOpen] = useState(false);
  const [isCreateCouponModalOpen, setIsCreateCouponModalOpen] = useState(false);

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

  const safeBanners = Array.isArray(banners) ? banners : [];
  const safeCoupons = Array.isArray(coupons) ? coupons : [];

  const createBannerMutation = useMutation({
    mutationFn: adminApi.createBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setIsCreateBannerModalOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create promotional banner.')),
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

  const createCouponMutation = useMutation({
    mutationFn: adminApi.createCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setIsCreateCouponModalOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create promotional coupon.')),
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
      message: 'Delete this promotional banner?',
      onConfirm: () => deleteBannerMutation.mutate(banner.id),
    });

  const requestCouponDelete = (coupon: AdminCoupon) =>
    setConfirmState({
      title: 'Delete Coupon Code',
      message: `Delete coupon code ${coupon.code}?`,
      onConfirm: () => deleteCouponMutation.mutate(coupon.id),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Coupon Engine"
        subtitle="Manage home screen hero carousels and checkout discount coupon campaigns"
        icon={Tag}
        actions={
          activeTab === 'BANNERS' ? (
            <Button
              size="sm"
              onClick={() => setIsCreateBannerModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Promotional Banner
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsCreateCouponModalOpen(true)}
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

      <PromotionsTabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        bannersCount={safeBanners.length}
        couponsCount={safeCoupons.length}
      />

      {activeTab === 'BANNERS' && (
        <BannerGrid
          banners={safeBanners}
          isLoading={isLoadingBanners}
          error={bannersError}
          onRetry={() => refetchBanners()}
          onToggle={toggleBanner}
          onDelete={requestBannerDelete}
          onAdd={() => setIsCreateBannerModalOpen(true)}
        />
      )}

      {activeTab === 'COUPONS' && (
        <CouponTable
          coupons={safeCoupons}
          isLoading={isLoadingCoupons}
          error={couponsError}
          onRetry={() => refetchCoupons()}
          onToggle={toggleCoupon}
          onDelete={requestCouponDelete}
          onAdd={() => setIsCreateCouponModalOpen(true)}
        />
      )}

      <BannerFormModal
        isOpen={isCreateBannerModalOpen}
        isSubmitting={createBannerMutation.isPending}
        onClose={() => setIsCreateBannerModalOpen(false)}
        onSubmit={(payload) =>
          createBannerMutation.mutate({
            ...payload,
            isActive: true,
          })
        }
        onUploadError={(message) => setActionError(message)}
      />

      <CouponFormModal
        isOpen={isCreateCouponModalOpen}
        isSubmitting={createCouponMutation.isPending}
        onClose={() => setIsCreateCouponModalOpen(false)}
        onSubmit={(payload) =>
          createCouponMutation.mutate({
            ...payload,
            isActive: true,
          })
        }
      />

      <ConfirmDeleteModal
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
      />
    </div>
  );
};
