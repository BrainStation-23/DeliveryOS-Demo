/// Canonical outlet display identity: "Brand - Outlet" (e.g. "Burger King - Gulshan").
///
/// The API exposes the bare outlet `name` and `brandName` as separate fields;
/// UIs compose them at render time with this single shared utility. Mirrors
/// the backend's outletDisplayName() including the anti-doubling guard.
String outletDisplayName(String? brandName, String outletName) {
  final brand = (brandName ?? '').trim();
  if (brand.isEmpty) return outletName;
  if (outletName == brand ||
      outletName.startsWith('$brand ') ||
      outletName.startsWith('$brand-') ||
      outletName.startsWith('$brand—')) {
    return outletName;
  }
  return '$brand - $outletName';
}
