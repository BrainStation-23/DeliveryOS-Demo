import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';
import adminApi, { AdminOutletType } from '../../services/adminApi';
import { extractApiError } from '../../utils/apiError';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const OUTLET_TYPES_QUERY_KEY = ['admin-outlet-types'] as const;

interface TypeFormState {
  name: string;
  slug: string;
  sortOrder: string;
}

const emptyForm: TypeFormState = { name: '', slug: '', sortOrder: '0' };

/**
 * Admin-managed outlet business types (Restaurant, Grocery, Pharmacy, …).
 * Deactivating a type hides every outlet of that type from the customer app —
 * the soft business control; deletes are refused while outlets are assigned.
 */
export const OutletTypesCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState<AdminOutletType | null>(null);
  const [form, setForm] = useState<TypeFormState>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<AdminOutletType | null>(null);

  const { data: types = [], isError, error, refetch } = useQuery({
    queryKey: OUTLET_TYPES_QUERY_KEY,
    queryFn: adminApi.listOutletTypes,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: OUTLET_TYPES_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: adminApi.createOutletType,
    onSuccess: () => {
      invalidate();
      setIsEditorOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create outlet type.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminApi.updateOutletType(id, payload),
    onSuccess: () => {
      invalidate();
      setIsEditorOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update outlet type.')),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteOutletType,
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => {
      setActionError(extractApiError(err, 'Failed to delete outlet type.'));
      setPendingDelete(null);
    },
  });

  const openCreate = () => {
    setEditingType(null);
    setForm(emptyForm);
    setIsEditorOpen(true);
  };

  const openEdit = (type: AdminOutletType) => {
    setEditingType(type);
    setForm({ name: type.name, slug: type.slug, sortOrder: String(type.sortOrder) });
    setIsEditorOpen(true);
  };

  const submitEditor = () => {
    const sortOrder = parseInt(form.sortOrder, 10) || 0;
    const slug = form.slug.trim();
    if (!form.name.trim()) {
      setActionError('Outlet type name is required.');
      return;
    }
    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        payload: {
          name: form.name.trim(),
          ...(slug ? { slug } : {}),
          ...(form.sortOrder !== String(editingType.sortOrder) ? { sortOrder } : {}),
        },
      });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        ...(slug ? { slug } : {}),
        ...(sortOrder ? { sortOrder } : {}),
      });
    }
  };

  const outletCount = (type: AdminOutletType) => type._count?.outlets ?? 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary-600" />
            Outlet Types
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Business categories assigned to outlets and shown as customer app chips. Switching a type off hides
            all of its outlets from customers; deletion requires zero assigned outlets.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          New Type
        </Button>
      </div>

      {actionError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </p>
      )}
      {isError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {extractApiError(error, 'Failed to load outlet types.')}
        </p>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-slate-800" data-testid="outlet-type-list">
        {types.map((type) => (
          <li key={type.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{type.name}</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {type.slug}
                </code>
                {type.isActive ? (
                  <Badge variant="success">Visible</Badge>
                ) : (
                  <Badge variant="danger">Hidden</Badge>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Sort {type.sortOrder} · {outletCount(type)} outlet{outletCount(type) === 1 ? '' : 's'} assigned
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary-600"
                checked={type.isActive}
                disabled={updateMutation.isPending}
                onChange={(e) =>
                  updateMutation.mutate({ id: type.id, payload: { isActive: e.target.checked } })
                }
              />
              {type.isActive ? 'Visible' : 'Hidden'}
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(type)}
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              aria-label={`Edit ${type.name}`}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPendingDelete(type)}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              aria-label={`Delete ${type.name}`}
            >
              Delete
            </Button>
          </li>
        ))}
        {types.length === 0 && !isError && (
          <li className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No outlet types yet — create one before adding outlets.
          </li>
        )}
      </ul>

      <div className="flex justify-end">
        {isError && (
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        )}
      </div>

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingType ? `Edit "${editingType.name}"` : 'New Outlet Type'}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Restaurant"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Slug (kebab-case, optional)
              </label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="restaurant"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sort Order
              </label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          {editingType && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Renaming or re-slugging updates the customer chip immediately.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitEditor}
              disabled={createMutation.isPending || updateMutation.isPending || !form.name.trim()}
            >
              {editingType ? 'Save Changes' : 'Create Type'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        confirmLabel="Delete Type"
        message={
          <>
            <p>
              This permanently removes the outlet type <strong>{pendingDelete?.name}</strong>.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deletion is refused while any outlet is still assigned — reassign those outlets first, or simply
              hide the type instead.
            </p>
          </>
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
};
