import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Building2,
  Bike,
  FileText,
  Tag,
  Settings,
  Menu,
  X,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Landmark,
  Images,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogoutButton } from '../components/common/LogoutButton';
import { Badge } from '../components/ui/Badge';

export const AdminLayout: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('deliveryos_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('deliveryos_admin_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const navItems = [
    { label: t('nav.admin.dashboard'), href: '/', icon: LayoutDashboard },
    { label: t('nav.admin.orders'), href: '/orders', icon: FileText },
    { label: t('nav.admin.fleet'), href: '/fleet', icon: Bike },
    { label: t('nav.admin.vendors'), href: '/vendors', icon: Building2 },
    { label: t('nav.admin.promotions'), href: '/promotions', icon: Tag },
    { label: t('nav.admin.customers'), href: '/customers', icon: Users },
    { label: t('nav.admin.media'), href: '/media', icon: Images },
    { label: t('nav.admin.finance'), href: '/finance', icon: Landmark },
    { label: t('nav.admin.settings'), href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/' || location.pathname === '/admin' || location.pathname === '/dashboard';
    return location.pathname === href || location.pathname.startsWith(`${href}/`) || location.pathname.startsWith(`/admin${href}`);
  };

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside
        className={`hidden lg:flex flex-col h-full shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 select-none transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64 xl:w-72'
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-100 dark:border-slate-800 ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4 sm:px-5'
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">DeliveryOS</h1>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 block truncate">
                    Admin Console
                  </span>
                </div>
              </div>
              <button
                onClick={toggleCollapse}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleCollapse}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/70 dark:text-primary-300 dark:hover:bg-primary-900/60 transition-colors shadow-xs"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 min-h-0 space-y-1 p-3 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl transition-all ${
                  isCollapsed ? 'h-10 w-10 mx-auto justify-center' : 'gap-3 px-3 py-2 text-sm font-medium'
                } ${
                  active
                    ? 'bg-primary-50 text-primary-700 shadow-xs dark:bg-primary-950/50 dark:text-primary-400 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {isCollapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!isCollapsed ? (
          <div className="shrink-0 mt-auto border-t border-slate-100 p-3 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={user?.fullName || undefined}>
                  {user?.fullName || 'Super Admin'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.role || 'SUPER_ADMIN'}
                </p>
              </div>
            </div>
            <LogoutButton onLogout={logout} />
          </div>
        ) : (
          <div className="shrink-0 mt-auto border-t border-slate-100 p-2.5 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-default"
              title={`${user?.fullName || 'Super Admin'} (${user?.role || 'SUPER_ADMIN'})`}
            >
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <LogoutButton onLogout={logout} variant="icon" />
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open mobile menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 lg:hidden">DeliveryOS</span>
              <Badge variant="purple" size="sm">Super Admin Portal</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full max-h-screen max-h-[100dvh] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">DeliveryOS</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                      Admin Console
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 min-h-0 space-y-1 p-3 overflow-y-auto overscroll-contain">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="shrink-0 mt-auto border-t border-slate-100 p-3 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.fullName?.charAt(0) || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={user?.fullName || undefined}>
                      {user?.fullName || 'Super Admin'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.role || 'SUPER_ADMIN'}
                    </p>
                  </div>
                </div>
                <LogoutButton
                  onLogout={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
