import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useVendorOutletStore, AccessibleOutlet } from '../stores/useVendorOutletStore';
import { PermissionScope } from '../types/auth';

export type { AccessibleOutlet } from '../stores/useVendorOutletStore';

interface VendorOutletContextType {
  activeOutletId: string;
  setActiveOutletId: (id: string) => void;
  outlets: AccessibleOutlet[];
  activeOutlet: AccessibleOutlet | null;
  isMultiBranch: boolean;
  isLoading: boolean;
  refetchOutlets: () => Promise<void>;
}

export const VendorOutletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchOutlets = useVendorOutletStore((s) => s.fetchOutlets);
  const reset = useVendorOutletStore((s) => s.reset);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOutlets();
    } else {
      reset();
    }
  }, [isAuthenticated, fetchOutlets, reset]);

  return <>{children}</>;
};

export const useVendorOutlet = (): VendorOutletContextType => {
  const activeOutletId = useVendorOutletStore((s) => s.activeOutletId);
  const setActiveOutletId = useVendorOutletStore((s) => s.setActiveOutletId);
  const outlets = useVendorOutletStore((s) => s.outlets);
  const isLoading = useVendorOutletStore((s) => s.isLoading);
  const refetchOutlets = useVendorOutletStore((s) => s.refetchOutlets);
  const activeOutlet = useVendorOutletStore((s) => s.getActiveOutlet());

  const user = useAuthStore((s) => s.user);
  const isMultiBranch = user?.outletScope === PermissionScope.ALL_OUTLETS_MASTER;

  return {
    activeOutletId,
    setActiveOutletId,
    outlets,
    activeOutlet,
    isMultiBranch,
    isLoading,
    refetchOutlets,
  };
};
