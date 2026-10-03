import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import adminApi from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Alert } from '../../../../components/ui/Alert';
import { extractApiError } from '../../../../utils/apiError';

export interface CategoryDialogProps {
  isOpen: boolean;
  vendorId: string;
  /** null = create; otherwise rename this category. */
  editing: { id: string; name: string } | null;
  onClose: () => void;
  onError: (message: string) => void;
}

/** Category create/rename dialog for an outlet's menu. */
export const CategoryDialog: React.FC<CategoryDialogProps> = ({
  isOpen,
  vendorId,
  editing,
  onClose,
  onError,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(editing?.name || '');
      setActionError(null);
    }
  }, [isOpen, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return adminApi.updateCategory(editing.id, { name: name.trim() });
      }
      return adminApi.createOutletCategory(vendorId, { name: name.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      onClose();
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to save the category.')),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Rename Category — ${editing.name}` : 'New Menu Category'}
      description={editing ? 'Products keep their category assignment' : 'Groups products on the outlet menu'}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            isLoading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {editing ? 'Save Category' : 'Create Category'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {actionError && <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Category Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Signature Burgers"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
};
