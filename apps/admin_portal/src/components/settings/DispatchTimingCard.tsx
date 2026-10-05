import React, { useEffect, useState } from 'react';
import { Timer, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface DispatchTimingConfig {
  riderSearchTimeoutSeconds: number;
  staleOrderTtlMinutes: number;
}

export interface DispatchTimingCardProps {
  timing: DispatchTimingConfig | null;
  isUpdating: boolean;
  onSaveTiming: (timing: DispatchTimingConfig) => void;
}

/**
 * Platform dispatch timing. The fulfillment sequence itself (RIDER_FIRST vs
 * VENDOR_FIRST) is configured per outlet on the outlet form — this card only
 * governs the shared timing knobs.
 */
export const DispatchTimingCard: React.FC<DispatchTimingCardProps> = ({ timing, isUpdating, onSaveTiming }) => {
  const [timeoutInput, setTimeoutInput] = useState('');
  const [staleTtlInput, setStaleTtlInput] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (timing) {
      setTimeoutInput(String(timing.riderSearchTimeoutSeconds));
      setStaleTtlInput(String(timing.staleOrderTtlMinutes));
    }
  }, [timing]);

  const timingDirty =
    !!timing &&
    (timeoutInput !== String(timing.riderSearchTimeoutSeconds) ||
      staleTtlInput !== String(timing.staleOrderTtlMinutes));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary-600" />
          Dispatch Timing
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Rider broadcast timeout before the dispatch escalation widens the search radius, and the sweep that
          auto-cancels stuck unassigned orders. The fulfillment sequence (RIDER_FIRST vs VENDOR_FIRST) is set per
          outlet on the outlet form.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rider Search Timeout (seconds, 15–600)
            </label>
            <Input
              type="number"
              value={timeoutInput}
              onChange={(e) => setTimeoutInput(e.target.value)}
              placeholder="90"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Stale Order Auto-Cancel (minutes, 5–720)
            </label>
            <Input
              type="number"
              value={staleTtlInput}
              onChange={(e) => setStaleTtlInput(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!timingDirty}
            onClick={() => setIsConfirmOpen(true)}
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            Save Timing
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Update Dispatch Timing?"
        confirmLabel="Apply Timing"
        message={
          <>
            <p>
              Set the rider search timeout to <strong>{timeoutInput || '—'}s</strong> and the stale-order
              auto-cancel sweep to <strong>{staleTtlInput || '—'} minutes</strong>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Timeout changes affect the next dispatch broadcast; the sweep picks up the new TTL on its next pass.
            </p>
          </>
        }
        isPending={isUpdating}
        onConfirm={() => {
          onSaveTiming({
            riderSearchTimeoutSeconds: parseInt(timeoutInput, 10) || 90,
            staleOrderTtlMinutes: parseInt(staleTtlInput, 10) || 60,
          });
          setIsConfirmOpen(false);
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </section>
  );
};
