import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Plus, Search, Store, Users } from 'lucide-react';
import adminApi, { AdminBrand } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { extractApiError } from '../../utils/apiError';
import { useDebounce } from '../../hooks/useDebounce';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { BrandFormModal } from './components/vendors/BrandFormModal';
import { StaffAccountsTab } from './components/vendors/StaffAccountsTab';

type VendorsTab = 'BRANDS' | 'STAFF';

/**
 * Unified Brand Page: every brand with search + creation. Brand cards expose
 * the owner (staff profile dialog) and the outlet list; clicking an outlet
 * opens the dedicated Outlet Page.
 */
export const AdminVendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VendorsTab>('BRANDS');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery);

  const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<AdminBrand | null>(null);

  const { data: brands = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-brands', debouncedSearch],
    queryFn: () => adminApi.getBrands(debouncedSearch),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  const safeBrands = Array.isArray(brands) ? brands : [];
  const safeVendors = Array.isArray(vendors) ? vendors : [];

  const createBrandMutation = useMutation({
    mutationFn: adminApi.createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      setIsBrandFormOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create brand.')),
  });

  const updateBrandMutation = useMutation({
    mutationFn: ({ brandId, data }: { brandId: string; data: { name?: string; logoUrl?: string } }) =>
      adminApi.updateBrand(brandId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setIsBrandFormOpen(false);
      setEditingBrand(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update brand.')),
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (brandId: string) => adminApi.deleteBrand(brandId),
    onSuccess: () => {
      setDeleteBrandTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete brand.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands & Outlets"
        subtitle="Govern brand umbrellas, drill into any outlet's catalog, staff accounts, and operating settings"
        icon={Building2}
        actions={
          activeTab === 'BRANDS' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingBrand(null);
                setIsBrandFormOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Brand
            </Button>
          ) : undefined
        }
      />

      {actionError && <QueryErrorBanner error={{ message: actionError } as never} onRetry={() => setActionError(null)} />}

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {([
          { id: 'BRANDS' as const, label: `Brands (${safeBrands.length})`, icon: Building2 },
          { id: 'STAFF' as const, label: 'Staff Accounts', icon: Users },
        ]).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
                isActive
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'BRANDS' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search brands by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading brands..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : safeBrands.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={debouncedSearch ? 'No brands match your search' : 'No brands yet'}
              message={
                debouncedSearch
                  ? `Nothing matches “${debouncedSearch}” — try another name or create a new brand.`
                  : 'Brands group multi-branch chains under one owner scope. Create the first brand to link outlets to it.'
              }
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingBrand(null);
                    setIsBrandFormOpen(true);
                  }}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Create Brand
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {safeBrands.map((brand) => {
                const outlets = safeVendors.filter((v) => v.brandId === brand.id);
                const owner = outlets.flatMap((v) => v.staff).find((s) => s.scope === 'ALL_OUTLETS_MASTER');
                return (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    outlets={outlets.map((v) => ({
                      id: v.id,
                      name: v.name,
                      addressText: v.addressText,
                      isActive: v.isActive,
                      isBusy: v.isBusy,
                      totalProducts: v.totalProducts,
                    }))}
                    owner={owner ? { id: owner.id, fullName: owner.fullName, phone: owner.phone, isActive: owner.isActive } : null}
                    isDeleting={deleteBrandMutation.isPending}
                    onEdit={() => {
                      setEditingBrand(brand);
                      setIsBrandFormOpen(true);
                    }}
                    onRequestDelete={() => setDeleteBrandTarget(brand)}
                    onOpenOutlet={(outletId) => navigate(`/outlets/${outletId}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'STAFF' && <StaffAccountsTab onError={setActionError} />}

      <BrandFormModal
        isOpen={isBrandFormOpen}
        isSubmitting={createBrandMutation.isPending || updateBrandMutation.isPending}
        editing={editingBrand}
        onClose={() => {
          setIsBrandFormOpen(false);
          setEditingBrand(null);
        }}
        onSubmit={(payload) => {
          if (editingBrand) {
            updateBrandMutation.mutate({ brandId: editingBrand.id, data: payload });
          } else {
            createBrandMutation.mutate(payload);
          }
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteBrandTarget}
        title="Delete Brand?"
        variant="danger"
        confirmLabel="Delete Brand"
        message={
          deleteBrandTarget && (
            <>
              <p>
                Permanently delete the brand{' '}
                <strong className="text-slate-900 dark:text-slate-100">{deleteBrandTarget.name}</strong>?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Blocked while any outlet or staff assignment still references the brand — reassign or remove them
                first.
              </p>
            </>
          )
        }
        isPending={deleteBrandMutation.isPending}
        onConfirm={() => {
          if (deleteBrandTarget) {
            deleteBrandMutation.mutate(deleteBrandTarget.id);
          }
        }}
        onCancel={() => setDeleteBrandTarget(null)}
      />
    </div>
  );
};

interface BrandCardOutlet {
  id: string;
  name: string;
  addressText: string;
  isActive: boolean;
  isBusy: boolean;
  totalProducts: number;
}

const BrandCard: React.FC<{
  brand: AdminBrand;
  outlets: BrandCardOutlet[];
  owner: { id: string; fullName: string; phone: string; isActive: boolean } | null;
  isDeleting: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onOpenOutlet: (outletId: string) => void;
}> = ({ brand, outlets, owner, isDeleting, onEdit, onRequestDelete, onOpenOutlet }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
    <div className="p-5 flex items-start gap-4 border-b border-slate-100 dark:border-slate-800">
      <div className="h-12 w-12 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center shrink-0 overflow-hidden">
        {brand.logoUrl ? (
          <img src={resolveMediaUrl(brand.logoUrl)} alt={brand.name} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{brand.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {brand.totalOutlets} outlet{brand.totalOutlets === 1 ? '' : 's'} · {brand.totalStaff} staff
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
              Edit Info
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              onClick={onRequestDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
        {owner && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
            <Users className="h-3 w-3 text-primary-600" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{owner.fullName}</span>
            <span className="text-[10px] text-slate-500">Brand Owner</span>
            {!owner.isActive && <Badge variant="danger">Inactive</Badge>}
          </div>
        )}
      </div>
    </div>

    <div className="p-3 space-y-1.5 bg-slate-50/50 dark:bg-slate-900">
      {outlets.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic px-2 py-1.5">
          No outlets yet — onboard one against this brand.
        </p>
      ) : (
        outlets.map((outlet) => (
          <button
            key={outlet.id}
            type="button"
            onClick={() => onOpenOutlet(outlet.id)}
            className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2 hover:border-primary-400 hover:ring-2 hover:ring-primary-500/20 transition-all cursor-pointer dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{outlet.name}</span>
                {!outlet.isActive && <Badge variant="danger">Suspended</Badge>}
                {outlet.isBusy && <Badge variant="warning">Rush</Badge>}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {outlet.addressText} · {outlet.totalProducts} products
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        ))
      )}
    </div>
  </div>
);
