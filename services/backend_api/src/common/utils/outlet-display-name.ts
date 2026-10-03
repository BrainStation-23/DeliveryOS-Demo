/**
 * Canonical outlet representation: "Brand <sep> Outlet". When the outlet
 * name already carries the brand (single-branch brands or legacy seeded
 * names), the name is shown once instead of doubled ("X — X").
 */
export function outletDisplayName(
  brandName: string | null | undefined,
  outletName: string | null | undefined,
  separator = ' — ',
): string {
  const outlet = outletName?.trim() || 'Store';
  const brand = brandName?.trim();
  if (!brand) return outlet;
  if (outlet === brand || outlet.startsWith(`${brand} `) || outlet.startsWith(`${brand}—`)) {
    return outlet;
  }
  return `${brand}${separator}${outlet}`;
}
