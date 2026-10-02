import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import adminApi from '../../../../services/adminApi';

/**
 * Catalog governance data for one outlet. Socket invalidation is overkill
 * here (menus rarely change mid-review), but successful overrides refresh
 * through the shared query key.
 */
export function useVendorCatalog(vendorId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-vendor-catalog', vendorId],
    queryFn: () => adminApi.getVendorCatalog(vendorId as string),
    enabled: !!vendorId,
    staleTime: 30000,
  });

  useEffect(() => {
    return () => {
      if (vendorId) {
        queryClient.removeQueries({ queryKey: ['admin-vendor-catalog', vendorId] });
      }
    };
  }, [vendorId, queryClient]);

  return query;
}
