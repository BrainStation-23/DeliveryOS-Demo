import React, { useState, useEffect } from 'react';
import { DollarSign, Layers, Truck, Check } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface DeliveryFeeConfig {
  mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
  flatFee?: number;
  baseFee?: number;
  baseKm?: number;
  perKmRate?: number;
}

export interface DeliveryFeeSettingsCardProps {
  initialConfig?: DeliveryFeeConfig;
  isSaving: boolean;
  onSave: (config: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee?: number;
    baseFee?: number;
    baseKm?: number;
    perKmRate?: number;
  }) => void;
}

export const DeliveryFeeSettingsCard: React.FC<DeliveryFeeSettingsCardProps> = ({
  initialConfig,
  isSaving,
  onSave,
}) => {
  const [feeMode, setFeeMode] = useState<'FIXED_FLAT' | 'DISTANCE_TIERED'>(
    initialConfig?.mode || 'FIXED_FLAT',
  );
  const [flatFeeInput, setFlatFeeInput] = useState<string>(
    String(initialConfig?.flatFee ?? 50),
  );
  const [baseFeeInput, setBaseFeeInput] = useState<string>(
    String(initialConfig?.baseFee ?? 40),
  );
  const [baseKmInput, setBaseKmInput] = useState<string>(
    String(initialConfig?.baseKm ?? 2),
  );
  const [perKmRateInput, setPerKmRateInput] = useState<string>(
    String(initialConfig?.perKmRate ?? 15),
  );

  useEffect(() => {
    if (initialConfig) {
      setFeeMode(initialConfig.mode);
      setFlatFeeInput(String(initialConfig.flatFee ?? 50));
      setBaseFeeInput(String(initialConfig.baseFee ?? 40));
      setBaseKmInput(String(initialConfig.baseKm ?? 2));
      setPerKmRateInput(String(initialConfig.perKmRate ?? 15));
    }
  }, [initialConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFlat = Math.max(0, parseFloat(flatFeeInput) || 0);
    const parsedBaseFee = Math.max(0, parseFloat(baseFeeInput) || 0);
    const parsedBaseKm = Math.max(0, parseFloat(baseKmInput) || 0);
    const parsedPerKmRate = Math.max(0, parseFloat(perKmRateInput) || 0);

    onSave({
      mode: feeMode,
      flatFee: parsedFlat,
      baseFee: parsedBaseFee,
      baseKm: parsedBaseKm,
      perKmRate: parsedPerKmRate,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary-600" />
            Delivery Fee Pricing Economics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure algorithmic customer delivery tariffs and dynamic spatial mileage economics calculated via PostGIS.
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          isLoading={isSaving}
          className="shrink-0 font-medium"
        >
          Save Pricing Rules
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="radiogroup" aria-label="Delivery Fee Calculation Mode">
        {/* Fixed Flat Fee Mode Card */}
        <div
          role="radio"
          aria-checked={feeMode === 'FIXED_FLAT'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setFeeMode('FIXED_FLAT');
            }
          }}
          onClick={() => setFeeMode('FIXED_FLAT')}
          className={`cursor-pointer rounded-xl border p-4 sm:p-5 transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 flex flex-col justify-between ${
            feeMode === 'FIXED_FLAT'
              ? 'border-primary-600 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-950/20 ring-2 ring-primary-500/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${
                  feeMode === 'FIXED_FLAT'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  <Layers className="h-5 w-5 shrink-0" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Fixed Flat Fee Mode
                </span>
              </div>
              {feeMode === 'FIXED_FLAT' && (
                <Badge variant="success" className="gap-1 shrink-0">
                  <Check className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every dispatched customer order is billed a predictable uniform delivery tariff across all serviceable radii, irrespective of radial distance.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Uniform Flat Delivery Fee (৳)
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              value={flatFeeInput}
              onChange={(e) => setFlatFeeInput(e.target.value)}
              placeholder="50"
              onClick={(e) => e.stopPropagation()}
              disabled={feeMode !== 'FIXED_FLAT'}
              className="w-full"
            />
          </div>
        </div>

        {/* Distance-Tiered Dynamic Mode Card */}
        <div
          role="radio"
          aria-checked={feeMode === 'DISTANCE_TIERED'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setFeeMode('DISTANCE_TIERED');
            }
          }}
          onClick={() => setFeeMode('DISTANCE_TIERED')}
          className={`cursor-pointer rounded-xl border p-4 sm:p-5 transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 flex flex-col justify-between ${
            feeMode === 'DISTANCE_TIERED'
              ? 'border-primary-600 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-950/20 ring-2 ring-primary-500/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${
                  feeMode === 'DISTANCE_TIERED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  <Truck className="h-5 w-5 shrink-0" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Distance-Tiered Dynamic Mode
                </span>
              </div>
              {feeMode === 'DISTANCE_TIERED' && (
                <Badge variant="success" className="gap-1 shrink-0">
                  <Check className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Base delivery tariff applied for initial threshold radius, plus incremental per-kilometer rates calculated dynamically via GPS geodesic coordinates.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Base Dist (km)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={baseKmInput}
                onChange={(e) => setBaseKmInput(e.target.value)}
                placeholder="2"
                onClick={(e) => e.stopPropagation()}
                disabled={feeMode !== 'DISTANCE_TIERED'}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Base Fee (৳)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={baseFeeInput}
                onChange={(e) => setBaseFeeInput(e.target.value)}
                placeholder="40"
                onClick={(e) => e.stopPropagation()}
                disabled={feeMode !== 'DISTANCE_TIERED'}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rate / km (৳)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={perKmRateInput}
                onChange={(e) => setPerKmRateInput(e.target.value)}
                placeholder="15"
                onClick={(e) => e.stopPropagation()}
                disabled={feeMode !== 'DISTANCE_TIERED'}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
