import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VENDOR_NAV_ITEMS, isVendorNavItemActive } from '../../config/vendorNavigation';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarNavListProps {
  navItems: NavItem[];
  isCollapsed?: boolean;
  onItemClick?: () => void;
}

export const SidebarNavList: React.FC<SidebarNavListProps> = ({
  navItems,
  isCollapsed = false,
  onItemClick,
}) => {
  const location = useLocation();

  const isActive = (href: string) => {
    const matched = VENDOR_NAV_ITEMS.find((n) => n.href === href);
    if (matched) {
      return isVendorNavItemActive(matched, location.pathname);
    }
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="flex-1 min-h-0 space-y-1 p-3 overflow-y-auto overscroll-contain">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            title={isCollapsed ? item.label : undefined}
            className={`flex items-center rounded-xl transition-all ${
              isCollapsed
                ? 'h-10 w-10 mx-auto justify-center'
                : 'gap-3 px-3 py-2 text-sm font-medium'
            } ${
              active
                ? 'bg-amber-50 text-amber-800 shadow-sm dark:bg-amber-950/50 dark:text-amber-400 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
              }`}
            />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
            {isCollapsed && <span className="sr-only">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
};
