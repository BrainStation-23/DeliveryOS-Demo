/**
 * Canonical "Brand — Outlet" display name with the same anti-doubling guard
 * as the backend's outletDisplayName(): outlets seeded/stored with the brand
 * already prefixed (e.g. "Burger King - Gulshan") are shown exactly once.
 */
export function outletDisplayName(
  brandName: string | null | undefined,
  outletName: string,
): string {
  if (!brandName) return outletName || 'Store';
  if (
    outletName === brandName ||
    outletName.startsWith(`${brandName} `) ||
    outletName.startsWith(`${brandName}-`) ||
    outletName.startsWith(`${brandName}—`)
  ) {
    return outletName;
  }
  return `${brandName} - ${outletName}`;
}
