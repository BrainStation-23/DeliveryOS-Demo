import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Plus, Building2, Users } from 'lucide-react';
import adminApi, { AdminBrand, AdminVendor } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { extractApiError } from '../../utils/apiError';
import { VendorCard } from './components/vendors/VendorCard';
import { CreateVendorModal } from './components/vendors/CreateVendorModal';
import { EditVendorModal } from './components/vendors/EditVendorModal';
import { StaffManagerModal } from './components/vendors/StaffManagerModal';
import { CatalogManagerModal } from './components/vendors/CatalogManagerModal';
import { BrandCard } from './components/vendors/BrandCard';
import { BrandFormModal } from './components/vendors/BrandFormModal';
import { StaffAccountsTab } from './components/vendors/StaffAccountsTab';

type VendorsTab = 'BRANDS' | 'OUTLETS' | 'STAFF';

export const AdminVendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VendorsTab>('OUTLETS');

  const [isCreateVendorModalOpen, setIsCreateVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AdminVendor | null>(null);
  const [staffTargetVendor, setStaffTargetVendor] = useState<AdminVendor | null>(null);
  const [catalogTargetVendor, setCatalogTargetVendor] = useState<AdminVendor | null>(null);

  const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<AdminBrand | null>(null);

  const { data: vendors = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: adminApi.getBrands,
  });

  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const safeBrands = Array.isArray(brands) ? brands : [];

  const createVendorMutation = useMutation({
    mutationFn: adminApi.createVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      setIsCreateVendorModalOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create vendor outlet.')),
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: Parameters<typeof adminApi.updateVendor>[1] }) =>
      adminApi.updateVendor(vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      setEditingVendor(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update vendor outlet.')),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ vendorId, isActive }: { vendorId: string; isActive: boolean }) =>
      adminApi.toggleVendorStatus(vendorId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update vendor status.')),
  });

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

  const tabs: Array<{ id: VendorsTab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }> = [
    { id: 'OUTLETS', label: `Outlets (${safeVendors.length})`, icon: Store, count: safeVendors.length },
    { id: 'BRANDS', label: `Brands (${safeBrands.length})`, icon: Building2, count: safeBrands.length },
    { id: 'STAFF', label: 'Staff Accounts', icon: Users, count: 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands, Outlets & Staff Governance"
        subtitle="Manage brand umbrellas, onboard outlets with their catalogs, and govern owner/staff accounts from one hub"
        icon={Store}
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
          ) : (
            <Button
              size="sm"
              onClick={() => setIsCreateVendorModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Onboard New Outlet
            </Button>
          )
        }
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
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
          {safeBrands.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No brands yet"
              message="Brands group multi-branch chains under one owner scope. Create your first brand umbrella to link outlets to it."
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {safeBrands.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  isDeleting={deleteBrandMutation.isPending}
                  onEdit={(b) => {
                    setEditingBrand(b);
                    setIsBrandFormOpen(true);
                  }}
                  onRequestDelete={setDeleteBrandTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'OUTLETS' && (
        <>
          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading merchant outlets..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : safeVendors.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No merchant outlets"
              message="No merchant outlets registered yet. Onboard your first outlet to start serving customers."
              action={
                <Button
                  size="sm"
                  onClick={() => setIsCreateVendorModalOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Onboard Outlet
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {safeVendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isTogglePending={
                    toggleStatusMutation.isPending && toggleStatusMutation.variables?.vendorId === vendor.id
                  }
                  onEdit={setEditingVendor}
                  onToggleStatus={(v) =>
                    toggleStatusMutation.mutate({ vendorId: v.id, isActive: !v.isActive })
                  }
                  onManageStaff={setStaffTargetVendor}
                  onOpenCatalog={setCatalogTargetVendor}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'STAFF' && <StaffAccountsTab onError={setActionError} />}

      <CreateVendorModal
        isOpen={isCreateVendorModalOpen}
        isSubmitting={createVendorMutation.isPending}
        brands={safeBrands}
        onClose={() => setIsCreateVendorModalOpen(false)}
        onSubmit={(payload) => createVendorMutation.mutate(payload)}
      />

      {editingVendor && (
        <EditVendorModal
          vendor={editingVendor}
          brands={safeBrands}
          isSubmitting={updateVendorMutation.isPending}
          onClose={() => setEditingVendor(null)}
          onSubmit={(payload) => updateVendorMutation.mutate({ vendorId: editingVendor.id, data: payload })}
        />
      )}

      <StaffManagerModal
        vendor={staffTargetVendor ? safeVendors.find((v) => v.id === staffTargetVendor.id) || staffTargetVendor : null}
        onClose={() => setStaffTargetVendor(null)}
      />

      <CatalogManagerModal
        vendor={catalogTargetVendor}
        onClose={() => setCatalogTargetVendor(null)}
        onError={setActionError}
      />

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
