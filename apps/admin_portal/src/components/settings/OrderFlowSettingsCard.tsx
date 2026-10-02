import React, { useEffect, useState } from 'react';
import { Shuffle, Truck, Store, Check, Save } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface DispatchTimingConfig {
  riderSearchTimeoutSeconds: number;
  staleOrderTtlMinutes: number;
}

export interface OrderFlowSettingsCardProps {
  currentMode: 'RIDER_FIRST' | 'VENDOR_FIRST';
  timing: DispatchTimingConfig | null;
  isUpdating: boolean;
  onUpdateMode: (mode: 'RIDER_FIRST' | 'VENDOR_FIRST') => void;
  onUpdateTiming: (timing: DispatchTimingConfig) => void;
}

const MODE_LABELS: Record<'RIDER_FIRST' | 'VENDOR_FIRST', string> = {
  RIDER_FIRST: 'RIDER_FIRST (Zero Food Waste Mode)',
  VENDOR_FIRST: 'VENDOR_FIRST (Traditional Retail Mode)',
};

export const OrderFlowSettingsCard: React.FC<OrderFlowSettingsCardProps> = ({
  currentMode,
  timing,
  isUpdating,
  onUpdateMode,
  onUpdateTiming,
}) => {
  const [pendingMode, setPendingMode] = useState<'RIDER_FIRST' | 'VENDOR_FIRST' | null>(null);
  const [timeoutInput, setTimeoutInput] = useState('');
  const [staleTtlInput, setStaleTtlInput] = useState('');
  const [isTimingConfirmOpen, setIsTimingConfirmOpen] = useState(false);

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

  const requestModeSwitch = (mode: 'RIDER_FIRST' | 'VENDOR_FIRST') => {
    if (mode !== currentMode && !isUpdating) {
      setPendingMode(mode);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-primary-600" />
          Order Fulfillment Pipeline Mode
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          DeliveryOS dynamic finite-state machine (FSM) dictates the coordination sequence between kitchen preparation and courier broadcast.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="radiogroup" aria-label="Order Fulfillment Pipeline Mode">
        {/* RIDER_FIRST Mode Card */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'RIDER_FIRST'}
          disabled={isUpdating}
          onClick={() => requestModeSwitch('RIDER_FIRST')}
          className={`text-left rounded-xl border p-4 sm:p-5 transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 ${
            currentMode === 'RIDER_FIRST'
              ? 'border-primary-600 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-950/20 ring-2 ring-primary-500/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
          } ${isUpdating ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${
                currentMode === 'RIDER_FIRST'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Truck className="h-5 w-5 shrink-0" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                RIDER_FIRST (Zero Food Waste Mode)
              </span>
            </div>
            {currentMode === 'RIDER_FIRST' && (
              <Badge variant="success" className="gap-1 shrink-0">
                <Check className="h-3 w-3" />
                Active
              </Badge>
            )}
          </div>
          <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            When an order is confirmed, broadcast goes directly to nearby couriers first. The kitchen bell remains withheld until a rider accepts the run, ensuring warm food is never prepped for missing transport.
          </p>
          <div className="mt-3 text-[11px] font-semibold text-primary-700 dark:text-primary-400 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-600 dark:bg-primary-400" />
            Recommended for Cloud Kitchens & High-Value Restaurants
          </div>
        </button>

        {/* VENDOR_FIRST Mode Card */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'VENDOR_FIRST'}
          disabled={isUpdating}
          onClick={() => requestModeSwitch('VENDOR_FIRST')}
          className={`text-left rounded-xl border p-4 sm:p-5 transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 ${
            currentMode === 'VENDOR_FIRST'
              ? 'border-primary-600 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-950/20 ring-2 ring-primary-500/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
          } ${isUpdating ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${
                currentMode === 'VENDOR_FIRST'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Store className="h-5 w-5 shrink-0" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                VENDOR_FIRST (Traditional Retail Mode)
              </span>
            </div>
            {currentMode === 'VENDOR_FIRST' && (
              <Badge variant="success" className="gap-1 shrink-0">
                <Check className="h-3 w-3" />
                Active
              </Badge>
            )}
          </div>
          <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The merchant receives the ticket and commences food preparation immediately. Courier broadcast is initiated when the merchant marks items &quot;Ready for Pickup&quot;, reducing driver curbside wait time.
          </p>
          <div className="mt-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            Recommended for Fast-Food Chains & Quick-Serve Bakeries
          </div>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dispatch Timing</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Rider broadcast timeout before the dispatch escalation widens the search radius, and the sweep that
            auto-cancels stuck unassigned orders.
          </p>
        </div>
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
            onClick={() => setIsTimingConfirmOpen(true)}
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            Save Timing
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isTimingConfirmOpen}
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
          onUpdateTiming({
            riderSearchTimeoutSeconds: parseInt(timeoutInput, 10) || 90,
            staleOrderTtlMinutes: parseInt(staleTtlInput, 10) || 60,
          });
          setIsTimingConfirmOpen(false);
        }}
        onCancel={() => setIsTimingConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={pendingMode !== null}
        title="Switch Dispatch Pipeline Mode?"
        message={
          <>
            <p>
              Change the platform dispatch mode from{' '}
              <strong className="text-slate-900 dark:text-slate-100">{MODE_LABELS[currentMode]}</strong> to{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {pendingMode ? MODE_LABELS[pendingMode] : ''}
              </strong>
              ?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This takes effect immediately: every new order placed after the switch will follow the new
              coordination sequence between kitchen preparation and courier broadcast.
            </p>
          </>
        }
        confirmLabel="Apply Switch"
        isPending={isUpdating}
        onConfirm={() => {
          if (pendingMode) {
            onUpdateMode(pendingMode);
          }
          setPendingMode(null);
        }}
        onCancel={() => setPendingMode(null)}
      />
    </section>
  );
};
