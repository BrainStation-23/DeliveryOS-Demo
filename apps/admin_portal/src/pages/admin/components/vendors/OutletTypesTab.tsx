import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import adminApi, { AdminOutletType } from '../../../../services/adminApi';
import { extractApiError } from '../../../../utils/apiError';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { SearchInput } from '../../../../components/common/SearchInput';
import { Alert } from '../../../../components/ui/Alert';
import { OutletTypeEditorModal } from './OutletTypeEditorModal';
import { AssignedOutletsModal } from './AssignedOutletsModal';
import { OutletTypesMetrics } from './OutletTypesMetrics';
import { OutletTypesTable } from './OutletTypesTable';
import {
  calculateOutletTypeStats,
  filterAndSortOutletTypes,
  getAdjacentReorderSwap,
  OutletTypeStatusFilter,
} from './outletTypeHelpers';
import { cn } from '../../../../utils/cn';

const OUTLET_TYPES_QUERY_KEY = ['admin-outlet-types'] as const;

export interface OutletTypesTabProps {
  onError?: (message: string) => void;
  onOpenOutlet?: (outletId: string) => void;
}

/**
 * Outlet Types Management Tab on Brands & Outlets Page.
 * Manages customer category discovery chips, display sequences, and category soft control.
 */
export const OutletTypesTab: React.FC<OutletTypesTabProps> = ({ onError, onOpenOutlet }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OutletTypeStatusFilter>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState<AdminOutletType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminOutletType | null>(null);
  const [viewingOutletsType, setViewingOutletsType] = useState<AdminOutletType | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const { data: rawTypes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: OUTLET_TYPES_QUERY_KEY,
    queryFn: adminApi.listOutletTypes,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: OUTLET_TYPES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
  };

  const handleError = (message: string) => {
    setActionError(message);
    if (onError) onError(message);
  };

  const createMutation = useMutation({
    mutationFn: adminApi.createOutletType,
    onSuccess: () => {
      invalidate();
      setIsEditorOpen(false);
      setActionError(null);
    },
    onError: (err) => handleError(extractApiError(err, 'Failed to create outlet business type.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof adminApi.updateOutletType>[1] }) =>
      adminApi.updateOutletType(id, payload),
    onSuccess: () => {
      invalidate();
      setIsEditorOpen(false);
      setTogglingId(null);
      setReorderingId(null);
      setActionError(null);
    },
    onError: (err) => {
      setTogglingId(null);
      setReorderingId(null);
      handleError(extractApiError(err, 'Failed to update outlet business type.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteOutletType,
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      setActionError(null);
    },
    onError: (err) => {
      handleError(extractApiError(err, 'Failed to delete outlet business type.'));
      setPendingDelete(null);
    },
  });

  const stats = calculateOutletTypeStats(rawTypes);
  const displayedTypes = filterAndSortOutletTypes(rawTypes, search, statusFilter);

  const handleOpenCreate = () => {
    setEditingType(null);
    setIsEditorOpen(true);
    setActionError(null);
  };

  const handleOpenEdit = (type: AdminOutletType) => {
    setEditingType(type);
    setIsEditorOpen(true);
    setActionError(null);
  };

  const handleSaveModal = (payload: {
    name: string;
    slug?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) => {
    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleVisibility = (type: AdminOutletType) => {
    setTogglingId(type.id);
    updateMutation.mutate({
      id: type.id,
      payload: { isActive: !type.isActive },
    });
  };

  const handleReorder = async (type: AdminOutletType, direction: 'up' | 'down') => {
    const currentIndex = displayedTypes.findIndex((t) => t.id === type.id);
    if (currentIndex === -1) return;

    const swapUpdates = getAdjacentReorderSwap(displayedTypes, currentIndex, direction);
    if (!swapUpdates || swapUpdates.length === 0) return;

    setReorderingId(type.id);
    try {
      await Promise.all(
        swapUpdates.map((item) =>
          adminApi.updateOutletType(item.id, { sortOrder: item.sortOrder }),
        ),
      );
      invalidate();
    } catch (err) {
      handleError(extractApiError(err, 'Failed to adjust display order.'));
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Metrics Ribbon */}
      <OutletTypesMetrics stats={stats} />

      {/* Action Error Banner */}
      {actionError && (
        <Alert
          type="error"
          message={actionError}
          onDismiss={() => setActionError(null)}
          className="my-1"
        />
      )}

      {/* Filter & Search Bar + New Type Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by category name or slug..."
          className="w-full sm:w-72"
        />

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('visible')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                statusFilter === 'visible'
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Visible ({stats.visibleCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('hidden')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                statusFilter === 'hidden'
                  ? 'bg-amber-600 text-white dark:bg-amber-500'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Hidden ({stats.hiddenCount})
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            New Outlet Type
          </Button>
        </div>
      </div>

      {/* Main Table / Data View */}
      <OutletTypesTable
        displayedTypes={displayedTypes}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
        reorderingId={reorderingId}
        togglingId={togglingId}
        onReorder={handleReorder}
        onToggleVisibility={handleToggleVisibility}
        onOpenEdit={handleOpenEdit}
        onRequestDelete={(type) => setPendingDelete(type)}
        onViewAssignedOutlets={(type) => setViewingOutletsType(type)}
        onClearFilters={() => {
          setSearch('');
          setStatusFilter('all');
        }}
        onCreateNew={handleOpenCreate}
      />

      {/* Retry on query failure */}
      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {extractApiError(error, 'Failed to retrieve outlet business types.')}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Editor Modal */}
      <OutletTypeEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        editingType={editingType}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onSave={handleSaveModal}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        confirmLabel="Delete Type"
        variant="danger"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to permanently delete the category{' '}
              <strong>{pendingDelete?.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This category currently has 0 assigned outlets. Once deleted, this action cannot be
              undone.
            </p>
          </div>
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {/* Assigned Outlets Modal */}
      <AssignedOutletsModal
        isOpen={viewingOutletsType !== null}
        onClose={() => setViewingOutletsType(null)}
        outletType={viewingOutletsType}
        onOpenOutlet={(outletId) => {
          setViewingOutletsType(null);
          if (onOpenOutlet) {
            onOpenOutlet(outletId);
          } else {
            navigate(`/outlets/${outletId}`);
          }
        }}
      />
    </div>
  );
};
