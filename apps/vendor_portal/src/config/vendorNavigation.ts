import {
  ClipboardList,
  Receipt,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export type VendorPageKey = 'kds' | 'catalog' | 'orders' | 'settings';

export interface VendorNavItem {
  key: VendorPageKey;
  href: string;
  icon: LucideIcon;
  /** Match `href` exactly instead of as a prefix (used by root / KDS board). */
  exact?: boolean;
  /** Extra paths that keep this item active. */
  aliases?: readonly string[];
}

/**
 * Single source of truth for Vendor Portal navigation.
 * Sidebar, mobile drawer, page headers, and document tab title all derive
 * from this list and corresponding i18n keys ('nav.vendor.<key>').
 */
export const VENDOR_NAV_ITEMS: readonly VendorNavItem[] = [
  { key: 'kds', href: '/', icon: ClipboardList, exact: true, aliases: ['/kds'] },
  { key: 'catalog', href: '/catalog', icon: UtensilsCrossed },
  { key: 'orders', href: '/orders', icon: Receipt },
  { key: 'settings', href: '/settings', icon: Store },
];

export const VENDOR_PAGE_ICONS: Readonly<Record<VendorPageKey, LucideIcon>> = Object.fromEntries(
  VENDOR_NAV_ITEMS.map((item) => [item.key, item.icon]),
) as Record<VendorPageKey, LucideIcon>;

const isPathOrChild = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`);

export function isVendorNavItemActive(item: VendorNavItem, pathname: string): boolean {
  return [item.href, ...(item.aliases ?? [])].some((path) =>
    item.exact ? pathname === path : isPathOrChild(pathname, path),
  );
}

export function findActiveVendorNavItem(pathname: string): VendorNavItem | undefined {
  return VENDOR_NAV_ITEMS.find((item) => isVendorNavItemActive(item, pathname));
}
