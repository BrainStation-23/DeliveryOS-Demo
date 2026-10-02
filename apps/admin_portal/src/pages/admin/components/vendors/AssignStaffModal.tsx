import React, { useState } from 'react';
import { AdminVendor } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

export interface AssignStaffPayload {
  userId: string;
  scope: 'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER';
}

interface AssignStaffModalProps {
  vendor: AdminVendor;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: AssignStaffPayload) => void;
}

export const AssignStaffModal: React.FC<AssignStaffModalProps> = ({
  vendor,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [staffUserId, setStaffUserId] = useState('');
  const [staffScope, setStaffScope] = useState<'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER'>(
    'PARTICULAR_OUTLET',
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Assign Staff User — ${vendor.name}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!staffUserId}
            isLoading={isSubmitting}
            onClick={() => onSubmit({ userId: staffUserId, scope: staffScope })}
          >
            Assign Staff Scope
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            User ID (UUID)
          </label>
          <Input
            value={staffUserId}
            onChange={(e) => setStaffUserId(e.target.value)}
            placeholder="User UUID from registered staff"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Permission Scope
          </label>
          <div className="space-y-2">
            <label
              className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                staffScope === 'PARTICULAR_OUTLET'
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="scope_choice"
                value="PARTICULAR_OUTLET"
                checked={staffScope === 'PARTICULAR_OUTLET'}
                onChange={() => setStaffScope('PARTICULAR_OUTLET')}
                className="mt-0.5 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  PARTICULAR_OUTLET (Branch Manager)
                </div>
                <p className="text-[11px] text-slate-500">
                  Strictly locked to this physical branch only. Cannot switch or view other stores.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                staffScope === 'ALL_OUTLETS_MASTER'
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="scope_choice"
                value="ALL_OUTLETS_MASTER"
                checked={staffScope === 'ALL_OUTLETS_MASTER'}
                onChange={() => setStaffScope('ALL_OUTLETS_MASTER')}
                className="mt-0.5 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  ALL_OUTLETS_MASTER (Brand Owner)
                </div>
                <p className="text-[11px] text-slate-500">
                  Full authority to switch between all branches under this brand and view consolidated ledgers.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
