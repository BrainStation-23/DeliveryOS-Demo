import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import adminApi, { AdminOperatingHour } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { Alert } from '../../../../components/ui/Alert';
import { extractApiError } from '../../../../utils/apiError';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DayRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface OperatingHoursEditorProps {
  isOpen: boolean;
  vendorId: string;
  hours: AdminOperatingHour[];
  onClose: () => void;
}

export const OperatingHoursEditor: React.FC<OperatingHoursEditorProps> = ({ isOpen, vendorId, hours, onClose }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<DayRow[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActionError(null);
      setRows(
        DAYS.map((_, index) => {
          const existing = hours.find((h) => h.dayOfWeek === index);
          return {
            dayOfWeek: index,
            openTime: existing?.openTime || '09:00',
            closeTime: existing?.closeTime || '23:00',
            isClosed: existing?.isClosed ?? false,
          };
        }),
      );
    }
  }, [isOpen, hours]);

  const saveMutation = useMutation({
    mutationFn: () => adminApi.updateOperatingHours(vendorId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['admin-outlets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      onClose();
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to save operating hours.')),
  });

  const patch = (index: number, data: Partial<DayRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...data } : r)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Operating Hours"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save Schedule
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {actionError && <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />}

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setRows((prev) => prev.map((r) => ({ ...r, openTime: '09:00', closeTime: '23:00', isClosed: false })))}
          >
            Copy 09:00–23:00 to All
          </Button>
        </div>

        {rows.map((row, index) => (
          <div key={row.dayOfWeek} className="flex items-center gap-3 text-xs">
            <span className="w-20 font-semibold text-slate-700 dark:text-slate-300">{DAYS[row.dayOfWeek]}</span>
            <input
              type="time"
              value={row.openTime}
              disabled={row.isClosed}
              onChange={(e) => patch(index, { openTime: e.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <span className="text-slate-400">–</span>
            <input
              type="time"
              value={row.closeTime}
              disabled={row.isClosed}
              onChange={(e) => patch(index, { closeTime: e.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none">
              <input
                type="checkbox"
                checked={row.isClosed}
                onChange={(e) => patch(index, { isClosed: e.target.checked })}
                className="rounded text-rose-500 focus:ring-rose-400"
              />
              <span className="text-slate-500">Closed</span>
            </label>
          </div>
        ))}
      </div>
    </Modal>
  );
};
