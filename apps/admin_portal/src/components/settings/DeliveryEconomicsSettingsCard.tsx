import React, { useEffect, useState } from 'react';
import { Gauge, Percent, Save, Timer } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface DeliveryEconomicsConfig {
  rider_share_percent: number;
  eta_avg_speed_kmh: number;
  eta_fallback_minutes: number;
}

export interface DeliveryEconomicsSettingsCardProps {
  initialConfig: DeliveryEconomicsConfig | null;
  isSaving: boolean;
  onSave: (config: DeliveryEconomicsConfig) => void;
}

/** Rider payout share + ETA economics editor. Changes invalidate the pricing
 *  engine cache server-side and apply to the next fee computation. */
export const DeliveryEconomicsSettingsCard: React.FC<DeliveryEconomicsSettingsCardProps> = ({
  initialConfig,
  isSaving,
  onSave,
}) => {
  const [shareInput, setShareInput] = useState('');
  const [speedInput, setSpeedInput] = useState('');
  const [fallbackInput, setFallbackInput] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setShareInput(String(initialConfig.rider_share_percent));
      setSpeedInput(String(initialConfig.eta_avg_speed_kmh));
      setFallbackInput(String(initialConfig.eta_fallback_minutes));
    }
  }, [initialConfig]);

  const nextConfig = (): DeliveryEconomicsConfig => ({
    rider_share_percent: parseInt(shareInput, 10) || 80,
    eta_avg_speed_kmh: parseInt(speedInput, 10) || 25,
    eta_fallback_minutes: parseInt(fallbackInput, 10) || 10,
  });

  const dirty =
    !!initialConfig &&
    (shareInput !== String(initialConfig.rider_share_percent) ||
      speedInput !== String(initialConfig.eta_avg_speed_kmh) ||
      fallbackInput !== String(initialConfig.eta_fallback_minutes));

  const parsed = nextConfig();
  const invalid =
    parsed.rider_share_percent < 0 ||
    parsed.rider_share_percent > 100 ||
    parsed.eta_avg_speed_kmh < 5 ||
    parsed.eta_avg_speed_kmh > 120 ||
    parsed.eta_fallback_minutes < 1 ||
    parsed.eta_fallback_minutes > 120;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary-600" />
          Delivery Economics
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          How each delivery fee is split with the courier and how trip ETAs are estimated. Updates apply to every
          new order immediately (pricing cache invalidated on save).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            <span className="inline-flex items-center gap-1"><Percent className="h-3 w-3" /> Rider Share (0–100%)</span>
          </label>
          <Input
            type="number"
            value={shareInput}
            onChange={(e) => setShareInput(e.target.value)}
            placeholder="80"
          />
          <p className="mt-1 text-[11px] text-slate-500">Couriers earn {shareInput || '80'}% of each delivery fee</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> Avg Speed (5–120 km/h)</span>
          </label>
          <Input
            type="number"
            value={speedInput}
            onChange={(e) => setSpeedInput(e.target.value)}
            placeholder="25"
          />
          <p className="mt-1 text-[11px] text-slate-500">Drives customer ETA estimates</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> Fallback ETA (1–120 min)</span>
          </label>
          <Input
            type="number"
            value={fallbackInput}
            onChange={(e) => setFallbackInput(e.target.value)}
            placeholder="10"
          />
          <p className="mt-1 text-[11px] text-slate-500">Shown when no route estimate exists</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!dirty || invalid}
          onClick={() => setIsConfirmOpen(true)}
          leftIcon={<Save className="h-3.5 w-3.5" />}
        >
          Save Economics
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Update Delivery Economics?"
        confirmLabel="Apply Changes"
        message={
          <>
            <p>
              Set the rider share to <strong>{parsed.rider_share_percent}%</strong>, average ETA speed to{' '}
              <strong>{parsed.eta_avg_speed_kmh} km/h</strong>, and the fallback ETA to{' '}
              <strong>{parsed.eta_fallback_minutes} minutes</strong>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Applies to all orders placed after the change — in-flight order pricing stays frozen.
            </p>
          </>
        }
        isPending={isSaving}
        onConfirm={() => {
          onSave(parsed);
          setIsConfirmOpen(false);
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </section>
  );
};
