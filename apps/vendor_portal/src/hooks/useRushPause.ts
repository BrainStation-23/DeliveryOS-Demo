import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVendorOutlet } from '../contexts/VendorOutletContext';
import kdsApi from '../services/kdsApi';

export function resolveTargetOutletState(
  targetOutletId: string | undefined,
  activeOutlet: { id: string; isBusy: boolean } | null,
  outlets: Array<{ id: string; isBusy: boolean }>,
) {
  const effectiveOutletId = targetOutletId || (activeOutlet && activeOutlet.id !== 'ALL' ? activeOutlet.id : undefined);
  const targetOutlet = effectiveOutletId
    ? outlets.find((o) => o.id === effectiveOutletId) ?? (activeOutlet?.id === effectiveOutletId ? activeOutlet : null)
    : null;
  return {
    effectiveOutletId,
    targetOutlet,
    isBusy: targetOutlet?.isBusy ?? false,
    canToggle: Boolean(effectiveOutletId),
  };
}

export function useRushPause(targetOutletId?: string) {
  const queryClient = useQueryClient();
  const { activeOutlet, outlets, refetchOutlets } = useVendorOutlet();
  const [isTogglingRush, setIsTogglingRush] = useState(false);

  const { effectiveOutletId, targetOutlet, isBusy, canToggle } = resolveTargetOutletState(
    targetOutletId,
    activeOutlet,
    outlets,
  );

  const toggleRushPause = async (explicitState?: boolean) => {
    if (!effectiveOutletId || isTogglingRush) return;
    try {
      setIsTogglingRush(true);
      const isCurrentlyBusy = targetOutlet?.isBusy ?? false;
      const nextBusy = explicitState !== undefined ? explicitState : !isCurrentlyBusy;
      await kdsApi.updateOutletSettings(effectiveOutletId, {
        isBusy: nextBusy,
      });
      await Promise.all([
        refetchOutlets(),
        queryClient.invalidateQueries({ queryKey: ['vendor-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['vendor-outlets'] }),
      ]);
    } catch (err) {
      console.error('Failed to toggle rush pause:', err);
      throw err;
    } finally {
      setIsTogglingRush(false);
    }
  };

  const handleToggle = () => {
    toggleRushPause();
  };

  return {
    isBusy: targetOutlet?.isBusy ?? false,
    isTogglingRush,
    toggleRushPause,
    handleToggle,
    canToggle: Boolean(effectiveOutletId),
  };
}
