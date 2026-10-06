import { AssignedOutletRow } from '../../../../services/adminApi';

/**
 * Filter assigned store outlets by case-insensitive keyword search matching
 * outlet name, parent brand name, physical address text, or contact phone.
 */
export function filterAssignedOutlets(
  outlets: AssignedOutletRow[],
  query: string,
): AssignedOutletRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return outlets;

  return outlets.filter((outlet) => {
    const matchName = outlet.name?.toLowerCase().includes(q) ?? false;
    const matchBrand = outlet.brandName?.toLowerCase().includes(q) ?? false;
    const matchAddress = outlet.addressText?.toLowerCase().includes(q) ?? false;
    const matchPhone = outlet.contactPhone?.toLowerCase().includes(q) ?? false;
    return matchName || matchBrand || matchAddress || matchPhone;
  });
}

/**
 * Derives a human-friendly composite title for the store row.
 */
export function formatOutletRowTitle(outlet: AssignedOutletRow): string {
  if (outlet.brandName && !outlet.name.toLowerCase().includes(outlet.brandName.toLowerCase())) {
    return `${outlet.brandName} - ${outlet.name}`;
  }
  return outlet.name;
}

/**
 * Aggregates statistics for the assigned outlets modal header ribbon.
 */
export function calculateAssignedOutletsStats(outlets: AssignedOutletRow[]) {
  const total = outlets.length;
  const activeCount = outlets.filter((o) => o.isActive).length;
  const busyCount = outlets.filter((o) => o.isBusy).length;
  const totalOrders = outlets.reduce((sum, o) => sum + (o.totalOrders ?? 0), 0);
  const totalProducts = outlets.reduce((sum, o) => sum + (o.totalProducts ?? 0), 0);

  return {
    total,
    activeCount,
    suspendedCount: total - activeCount,
    busyCount,
    acceptingCount: total - busyCount,
    totalOrders,
    totalProducts,
  };
}
