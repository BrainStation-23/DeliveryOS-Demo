import {
  Bike,
  Building2,
  ClipboardList,
  Images,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AdminPageKey =
  | 'dashboard'
  | 'orders'
  | 'fleet'
  | 'vendors'
  | 'customers'
  | 'promotions'
  | 'media'
  | 'finance'
  | 'settings';

export interface AdminNavItem {
  key: AdminPageKey;
  href: string;
  icon: LucideIcon;
  /** Match `href` exactly instead of as a path prefix (used by the root dashboard route). */
  exact?: boolean;
  /** Extra paths that keep this item highlighted (drill-down pages, route aliases). */
  aliases?: readonly string[];
}

/**
 * Single source of truth for the Super Admin console navigation. The sidebar,
 * mobile drawer, page headers and browser tab title all derive from this list
 * and the `nav.admin.<key>` / `pages.<key>.subtitle` i18n keys, so a page title
 * can never drift from its sidebar label. Icon convention (shared with the
 * vendor portal): brand = Building2, outlet = Store.
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard, exact: true, aliases: ['/dashboard'] },
  { key: 'orders', href: '/orders', icon: ClipboardList },
  { key: 'fleet', href: '/fleet', icon: Bike },
  { key: 'vendors', href: '/vendors', icon: Building2, aliases: ['/outlets'] },
  { key: 'customers', href: '/customers', icon: Users },
  { key: 'promotions', href: '/promotions', icon: Megaphone },
  { key: 'media', href: '/media', icon: Images },
  { key: 'finance', href: '/finance', icon: Landmark },
  { key: 'settings', href: '/settings', icon: Settings },
];

export const ADMIN_PAGE_ICONS: Readonly<Record<AdminPageKey, LucideIcon>> = Object.fromEntries(
  ADMIN_NAV_ITEMS.map((item) => [item.key, item.icon]),
) as Record<AdminPageKey, LucideIcon>;

const isPathOrChild = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`);

export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  return [item.href, ...(item.aliases ?? [])].some((path) =>
    item.exact ? pathname === path : isPathOrChild(pathname, path),
  );
}

export function findActiveNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
}
