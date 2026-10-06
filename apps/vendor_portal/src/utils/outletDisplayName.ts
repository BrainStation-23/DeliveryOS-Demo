/**
 * Canonical "Brand - Outlet" outlet label (e.g. "Burger King - Gulshan").
 * The API exposes the bare outlet name and brandName as separate fields;
 * compose them at render time with the same anti-doubling guard as the
 * backend helper.
 */
export function outletLabel(outlet: { name: string; brandName?: string | null }): string {
  const brand = outlet.brandName?.trim();
  if (
    !brand ||
    outlet.name === brand ||
    outlet.name.startsWith(`${brand} `) ||
    outlet.name.startsWith(`${brand}-`)
  ) {
    return outlet.name;
  }
  return `${brand} - ${outlet.name}`;
}
