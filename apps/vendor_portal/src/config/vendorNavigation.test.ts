import { describe, expect, it } from 'vitest';
import {
  ClipboardList,
  Receipt,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import {
  VENDOR_NAV_ITEMS,
  VENDOR_PAGE_ICONS,
  findActiveVendorNavItem,
  isVendorNavItemActive,
} from './vendorNavigation';

describe('vendorNavigation configuration', () => {
  it('exposes exactly the 4 canonical vendor navigation routes', () => {
    const keys = VENDOR_NAV_ITEMS.map((item) => item.key);
    expect(keys).toEqual(['kds', 'catalog', 'orders', 'settings']);
  });

  it('binds the expected canonical Lucide icons to every page', () => {
    expect(VENDOR_PAGE_ICONS.kds).toBe(ClipboardList);
    expect(VENDOR_PAGE_ICONS.catalog).toBe(UtensilsCrossed);
    expect(VENDOR_PAGE_ICONS.orders).toBe(Receipt);
    expect(VENDOR_PAGE_ICONS.settings).toBe(Store);
  });

  it('matches root / and /kds alias to KDS Live Orders nav item', () => {
    const kdsItem = VENDOR_NAV_ITEMS.find((item) => item.key === 'kds')!;
    expect(isVendorNavItemActive(kdsItem, '/')).toBe(true);
    expect(isVendorNavItemActive(kdsItem, '/kds')).toBe(true);
    expect(isVendorNavItemActive(kdsItem, '/catalog')).toBe(false);

    expect(findActiveVendorNavItem('/')?.key).toBe('kds');
    expect(findActiveVendorNavItem('/kds')?.key).toBe('kds');
  });

  it('matches catalog, orders, and settings with subpaths', () => {
    const catalogItem = VENDOR_NAV_ITEMS.find((item) => item.key === 'catalog')!;
    expect(isVendorNavItemActive(catalogItem, '/catalog')).toBe(true);
    expect(isVendorNavItemActive(catalogItem, '/catalog/products/123')).toBe(true);
    expect(isVendorNavItemActive(catalogItem, '/orders')).toBe(false);

    const ordersItem = VENDOR_NAV_ITEMS.find((item) => item.key === 'orders')!;
    expect(isVendorNavItemActive(ordersItem, '/orders')).toBe(true);
    expect(isVendorNavItemActive(ordersItem, '/orders/123')).toBe(true);

    const settingsItem = VENDOR_NAV_ITEMS.find((item) => item.key === 'settings')!;
    expect(isVendorNavItemActive(settingsItem, '/settings')).toBe(true);
  });

  it('returns undefined for non-existent routes', () => {
    expect(findActiveVendorNavItem('/unknown-path')).toBeUndefined();
  });
});
