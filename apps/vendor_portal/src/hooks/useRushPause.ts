import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVendorOutlet } from '../contexts/VendorOutletContext';
import kdsApi from '../services/kdsApi';

export function useRushPause(targetOutletId?: string) {
  const queryClient = useQueryClient();
  const { activeOutlet, refetchOutlets } = useVendorOutlet();
  const [isTogglingRush, setIsTogglingRush] = useState(false);

  const effectiveOutletId = targetOutletId || (activeOutlet && activeOutlet.id !== 'ALL' ? activeOutlet.id : undefined);

  const toggleRushPause = async (explicitState?: boolean) => {
    if (!effectiveOutletId || isTogglingRush) return;
    try {
      setIsTogglingRush(true);
      const isCurrentlyBusy = activeOutlet?.id === effectiveOutletId ? activeOutlet.isBusy : false;
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
    isBusy: activeOutlet?.isBusy ?? false,
    isTogglingRush,
    toggleRushPause,
    handleToggle,
    canToggle: Boolean(effectiveOutletId),
  };
}
