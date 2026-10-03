import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_ITEMS,
  ADMIN_PAGE_ICONS,
  findActiveNavItem,
  isNavItemActive,
} from './adminNavigation';

describe('adminNavigation configuration & active-route matcher', () => {
  it('defines the complete 9-item admin console navigation set', () => {
    expect(ADMIN_NAV_ITEMS).toHaveLength(9);
    const keys = ADMIN_NAV_ITEMS.map((item) => item.key);
    expect(keys).toEqual([
      'dashboard',
      'orders',
      'fleet',
      'vendors',
      'customers',
      'promotions',
      'media',
      'finance',
      'settings',
    ]);
  });

  it('provides a valid icon for every registered admin page key', () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(ADMIN_PAGE_ICONS[item.key]).toBeDefined();
      expect(ADMIN_PAGE_ICONS[item.key]).toBe(item.icon);
    }
  });

  describe('isNavItemActive', () => {
    const dashboardItem = ADMIN_NAV_ITEMS.find((i) => i.key === 'dashboard')!;
    const ordersItem = ADMIN_NAV_ITEMS.find((i) => i.key === 'orders')!;
    const vendorsItem = ADMIN_NAV_ITEMS.find((i) => i.key === 'vendors')!;
    const fleetItem = ADMIN_NAV_ITEMS.find((i) => i.key === 'fleet')!;

    it('matches root and /dashboard exactly for the dashboard nav item', () => {
      expect(isNavItemActive(dashboardItem, '/')).toBe(true);
      expect(isNavItemActive(dashboardItem, '/dashboard')).toBe(true);
      expect(isNavItemActive(dashboardItem, '/orders')).toBe(false);
      expect(isNavItemActive(dashboardItem, '/dashboard/nested')).toBe(false);
    });

    it('matches prefix paths for standard routes like /orders', () => {
      expect(isNavItemActive(ordersItem, '/orders')).toBe(true);
      expect(isNavItemActive(ordersItem, '/orders/ORD-123')).toBe(true);
      expect(isNavItemActive(ordersItem, '/fleet')).toBe(false);
    });

    it('preserves active highlighting for drill-down sub-routes (e.g. /outlets/:id under /vendors)', () => {
      expect(isNavItemActive(vendorsItem, '/vendors')).toBe(true);
      expect(isNavItemActive(vendorsItem, '/vendors/brands')).toBe(true);
      expect(isNavItemActive(vendorsItem, '/outlets/outlet-12345')).toBe(true);
      expect(isNavItemActive(vendorsItem, '/customers')).toBe(false);
    });

    it('correctly isolates fleet route highlighting', () => {
      expect(isNavItemActive(fleetItem, '/fleet')).toBe(true);
      expect(isNavItemActive(fleetItem, '/fleet/active')).toBe(true);
      expect(isNavItemActive(fleetItem, '/orders')).toBe(false);
    });
  });

  describe('findActiveNavItem', () => {
    it('resolves active item for top-level and alias routes', () => {
      expect(findActiveNavItem('/')?.key).toBe('dashboard');
      expect(findActiveNavItem('/dashboard')?.key).toBe('dashboard');
      expect(findActiveNavItem('/orders')?.key).toBe('orders');
      expect(findActiveNavItem('/fleet')?.key).toBe('fleet');
      expect(findActiveNavItem('/outlets/outlet-99')?.key).toBe('vendors');
      expect(findActiveNavItem('/settings')?.key).toBe('settings');
      expect(findActiveNavItem('/unknown-route')).toBeUndefined();
    });
  });
});
