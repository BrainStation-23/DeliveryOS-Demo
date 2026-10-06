/**
 * Canonical outlet representation: "Brand - Outlet" (e.g. "Burger King - Gulshan").
 * The database stores the bare outlet name; this helper composes the full UI
 * name wherever a human-facing outlet string crosses an API boundary. When the
 * outlet name already carries the brand, the name is shown once instead of
 * doubled ("X - X").
 */
export function outletDisplayName(
  brandName: string | null | undefined,
  outletName: string | null | undefined,
  separator = ' - ',
): string {
  const outlet = outletName?.trim() || 'Store';
  const brand = brandName?.trim();
  if (!brand) return outlet;
  if (
    outlet === brand ||
    outlet.startsWith(`${brand} `) ||
    outlet.startsWith(`${brand}-`) ||
    outlet.startsWith(`${brand}—`)
  ) {
    return outlet;
  }
  return `${brand}${separator}${outlet}`;
}
