import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Plus } from 'lucide-react';
import adminApi, { AdminVendor } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { VendorCard } from './components/vendors/VendorCard';
import { CreateVendorModal } from './components/vendors/CreateVendorModal';
import { EditVendorModal } from './components/vendors/EditVendorModal';
import { AssignStaffModal } from './components/vendors/AssignStaffModal';

export const AdminVendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateVendorModalOpen, setIsCreateVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AdminVendor | null>(null);
  const [staffTargetVendor, setStaffTargetVendor] = useState<AdminVendor | null>(null);

  const { data: vendors = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  const safeVendors = Array.isArray(vendors) ? vendors : [];

  const createVendorMutation = useMutation({
    mutationFn: adminApi.createVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setIsCreateVendorModalOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create vendor outlet.')),
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: Parameters<typeof adminApi.updateVendor>[1] }) =>
      adminApi.updateVendor(vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
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

  const assignStaffMutation = useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: Parameters<typeof adminApi.assignVendorStaff>[1] }) =>
      adminApi.assignVendorStaff(vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setStaffTargetVendor(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to assign staff member.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Outlets & Staff Governance"
        subtitle="Onboard new physical outlets, set commission terms, and assign multi-tier management scopes"
        icon={Store}
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateVendorModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Onboard New Outlet
          </Button>
        }
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

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
              onAssignStaff={setStaffTargetVendor}
            />
          ))}
        </div>
      )}

      <CreateVendorModal
        isOpen={isCreateVendorModalOpen}
        isSubmitting={createVendorMutation.isPending}
        onClose={() => setIsCreateVendorModalOpen(false)}
        onSubmit={(payload) => createVendorMutation.mutate(payload)}
      />

      {editingVendor && (
        <EditVendorModal
          vendor={editingVendor}
          isSubmitting={updateVendorMutation.isPending}
          onClose={() => setEditingVendor(null)}
          onSubmit={(payload) => updateVendorMutation.mutate({ vendorId: editingVendor.id, data: payload })}
        />
      )}

      {staffTargetVendor && (
        <AssignStaffModal
          vendor={staffTargetVendor}
          isSubmitting={assignStaffMutation.isPending}
          onClose={() => setStaffTargetVendor(null)}
          onSubmit={(payload) =>
            assignStaffMutation.mutate({ vendorId: staffTargetVendor.id, data: payload })
          }
        />
      )}
    </div>
  );
};
