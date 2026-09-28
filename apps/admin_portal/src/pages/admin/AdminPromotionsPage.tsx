import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Image as ImageIcon,
  Plus,
  Trash2,
  Percent,
} from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';

export const AdminPromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'BANNERS' | 'COUPONS'>('BANNERS');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isCreateBannerModalOpen, setIsCreateBannerModalOpen] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [bannerSortOrder, setBannerSortOrder] = useState('0');

  const [isCreateCouponModalOpen, setIsCreateCouponModalOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDescription, setCouponDescription] = useState('');
  const [couponType, setCouponType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [couponValue, setCouponValue] = useState('20');
  const [minSpend, setMinSpend] = useState('300');
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [usageLimit, setUsageLimit] = useState('500');

  const {
    data: banners = [],
    isLoading: isLoadingBanners,
    isError: isBannersError,
    error: bannersError,
    refetch: refetchBanners,
  } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: adminApi.getBanners,
  });

  const {
    data: coupons = [],
    isLoading: isLoadingCoupons,
    isError: isCouponsError,
    error: couponsError,
    refetch: refetchCoupons,
  } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: adminApi.getCoupons,
  });

  const createBannerMutation = useMutation({
    mutationFn: adminApi.createBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setIsCreateBannerModalOpen(false);
      setBannerTitle('');
      setBannerImageUrl('');
      setBannerSortOrder('0');
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
      setCouponCode('');
      setCouponDescription('');
      setCouponValue('20');
      setMinSpend('300');
      setMaxDiscount('100');
      setUsageLimit('500');
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

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('BANNERS')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
            activeTab === 'BANNERS'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span>Promotional Banners ({banners.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('COUPONS')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
            activeTab === 'COUPONS'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Percent className="h-4 w-4 shrink-0" />
          <span>Discount Coupons ({coupons.length})</span>
        </button>
      </div>

      {activeTab === 'BANNERS' && (
        <div>
          {isLoadingBanners ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading promotional banners..." />
            </div>
          ) : isBannersError ? (
            <QueryErrorBanner error={bannersError} onRetry={() => refetchBanners()} />
          ) : banners.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No promotional banners"
              message="No promotional banners created yet. Add your first hero banner to showcase offers."
              action={
                <Button
                  size="sm"
                  onClick={() => setIsCreateBannerModalOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add Banner
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-40 bg-slate-100 dark:bg-slate-800">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600';
                        }}
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        {banner.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Paused</Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{banner.title}</h3>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>Order Rank: #{banner.sortOrder}</span>
                        <span>Link: {banner.linkType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() =>
                          toggleBannerMutation.mutate({
                            id: banner.id,
                            isActive: !banner.isActive,
                          })
                        }
                      >
                        {banner.isActive ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        onClick={() =>
                          setConfirmState({
                            title: 'Delete Promotional Banner',
                            message: 'Delete this promotional banner?',
                            onConfirm: () => deleteBannerMutation.mutate(banner.id),
                          })
                        }
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'COUPONS' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {isLoadingCoupons ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading coupons..." />
            </div>
          ) : isCouponsError ? (
            <QueryErrorBanner error={couponsError} onRetry={() => refetchCoupons()} />
          ) : coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No coupon codes"
              message="No promo coupon codes created yet. Create codes like WELCOME50 for customers."
              action={
                <Button
                  size="sm"
                  onClick={() => setIsCreateCouponModalOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Create Coupon
                </Button>
              }
              className="m-4"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Promo Code</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Discount Rule</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Min Spend</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Max Cap</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Usage</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {coupon.code}
                        {coupon.description && (
                          <div className="text-[11px] font-normal text-slate-500">{coupon.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          {coupon.discountType === 'PERCENTAGE'
                            ? `${coupon.discountValue}% OFF`
                            : `৳${coupon.discountValue} FLAT`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ৳{coupon.minOrderAmount}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {coupon.maxDiscountAmount ? `৳${coupon.maxDiscountAmount}` : 'No Cap'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{coupon.currentUses}</span>
                        <span className="text-slate-400"> / {coupon.usageLimit}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {coupon.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Paused</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() =>
                              toggleCouponMutation.mutate({
                                id: coupon.id,
                                isActive: !coupon.isActive,
                              })
                            }
                          >
                            {coupon.isActive ? 'Pause' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() =>
                              setConfirmState({
                                title: 'Delete Coupon Code',
                                message: `Delete coupon code ${coupon.code}?`,
                                onConfirm: () => deleteCouponMutation.mutate(coupon.id),
                              })
                            }
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isCreateBannerModalOpen}
        onClose={() => setIsCreateBannerModalOpen(false)}
        title="Add Promotional Hero Banner"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsCreateBannerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!bannerTitle || !bannerImageUrl}
              isLoading={createBannerMutation.isPending}
              onClick={() =>
                createBannerMutation.mutate({
                  title: bannerTitle,
                  imageUrl: bannerImageUrl,
                  sortOrder: parseInt(bannerSortOrder, 10) || 0,
                  isActive: true,
                })
              }
            >
              Publish Banner
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Banner Title
            </label>
            <Input
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              placeholder="e.g. 50% Off Pilot Weekend Feast"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Banner Image (Upload or paste a URL)
            </label>
            <div className="flex gap-2">
              <Input
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="https://… or upload a file"
              />
              <label
                className={`inline-flex shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
                  isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploadingImage ? 'Uploading…' : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setIsUploadingImage(true);
                    try {
                      const url = await adminApi.uploadImage(file);
                      setBannerImageUrl(url);
                      setActionError(null);
                    } catch (err) {
                      setActionError(extractApiError(err, 'Image upload failed.'));
                    } finally {
                      setIsUploadingImage(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Display Sequence Rank (Sort Order)
            </label>
            <Input
              type="number"
              value={bannerSortOrder}
              onChange={(e) => setBannerSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCreateCouponModalOpen}
        onClose={() => setIsCreateCouponModalOpen(false)}
        title="Create Promotional Discount Coupon"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsCreateCouponModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!couponCode || !couponValue}
              isLoading={createCouponMutation.isPending}
              onClick={() =>
                createCouponMutation.mutate({
                  code: couponCode,
                  description: couponDescription,
                  discountType: couponType,
                  discountValue: parseFloat(couponValue) || 0,
                  minOrderAmount: parseFloat(minSpend) || 0,
                  maxDiscountAmount: maxDiscount ? parseFloat(maxDiscount) : undefined,
                  usageLimit: parseInt(usageLimit, 10) || 1000,
                  isActive: true,
                })
              }
            >
              Activate Promo Code
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Coupon Code (Alphanumeric)
            </label>
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <Input
              value={couponDescription}
              onChange={(e) => setCouponDescription(e.target.value)}
              placeholder="e.g. 20% discount on first 5 orders"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Discount Type
              </label>
              <select
                value={couponType}
                onChange={(e) => setCouponType(e.target.value as 'PERCENTAGE' | 'FLAT')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Deduction (৳)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Discount Value
              </label>
              <Input
                type="number"
                value={couponValue}
                onChange={(e) => setCouponValue(e.target.value)}
                placeholder="20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Min Spend (৳)
              </label>
              <Input
                type="number"
                value={minSpend}
                onChange={(e) => setMinSpend(e.target.value)}
                placeholder="300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Cap (৳)
              </label>
              <Input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Usage Limit
              </label>
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="500"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title}
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
