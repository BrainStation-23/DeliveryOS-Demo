import { useState } from 'react';
import { useVendorOutlet } from '../contexts/VendorOutletContext';
import kdsApi from '../services/kdsApi';

export function useRushPause() {
  const { activeOutlet, refetchOutlets } = useVendorOutlet();
  const [isTogglingRush, setIsTogglingRush] = useState(false);

  const toggleRushPause = async (explicitState?: boolean) => {
    if (!activeOutlet || activeOutlet.id === 'ALL' || isTogglingRush) return;
    try {
      setIsTogglingRush(true);
      const nextBusy = explicitState !== undefined ? explicitState : !activeOutlet.isBusy;
      await kdsApi.updateOutletSettings(activeOutlet.id, {
        isBusy: nextBusy,
      });
      await refetchOutlets();
    } catch (err) {
      console.error('Failed to toggle rush pause:', err);
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
    canToggle: Boolean(activeOutlet && activeOutlet.id !== 'ALL'),
  };
}
