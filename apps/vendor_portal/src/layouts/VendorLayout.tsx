import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UtensilsCrossed,
  Layers,
  History,
  Store,
  LogOut,
  Volume2,
  VolumeX,
  Menu,
  X,
  BellRing,
  AlertTriangle,
  Flame,
  PauseCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VendorOutletProvider, useVendorOutlet, AccessibleOutlet } from '../contexts/VendorOutletContext';
import { OutletSwitcher } from '../components/vendor/OutletSwitcher';
import { LanguageSelector } from '../components/LanguageSelector';
import { soundEngine } from '../utils/sound';
import { useRushPause } from '../hooks/useRushPause';

interface ActiveOutletStripProps {
  activeOutlet: AccessibleOutlet | null;
  outlets: AccessibleOutlet[];
  activeOutletId: string;
  isMultiBranch: boolean;
  vendorName?: string | null;
  isCollapsed?: boolean;
}

const ActiveOutletStrip: React.FC<ActiveOutletStripProps> = ({
  activeOutlet,
  outlets,
  activeOutletId,
  isMultiBranch,
  vendorName,
  isCollapsed,
}) => {
  const isConsolidated = isMultiBranch && (!activeOutlet || activeOutletId === 'ALL');
  const targetOutlet = activeOutlet || (outlets.length > 0 ? outlets[0] : null);

  const outletName = isConsolidated
    ? 'All Outlets (Consolidated)'
    : targetOutlet?.name || vendorName || 'Primary Store';

  if (isCollapsed) {
    return (
      <div className="shrink-0 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-center">
        <div
          className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center cursor-default shadow-xs"
          title={`Active Branch: ${outletName}`}
        >
          <Store className="h-4 w-4 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Active Branch
      </span>
      <p
        className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words"
        title={outletName}
      >
        {outletName}
      </p>
    </div>
  );
};

const VendorLayoutInner: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeOutlet, outlets, activeOutletId, isMultiBranch } = useVendorOutlet();
  const location = useLocation();
  const [isMuted, setIsMuted] = useState(soundEngine.getIsMuted());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isTogglingRush, toggleRushPause } = useRushPause();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('deliveryos_vendor_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('deliveryos_vendor_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const navItems = [
    { label: t('nav.vendor.kds'), href: '/', icon: UtensilsCrossed },
    { label: t('nav.vendor.catalog'), href: '/catalog', icon: Layers },
    { label: t('nav.vendor.orders'), href: '/orders', icon: History },
    { label: t('nav.vendor.settings'), href: '/settings', icon: Store },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/' || location.pathname === '/kds';
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const toggleSound = () => {
    const nextMuted = !isMuted;
    soundEngine.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playChime();
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shrink-0">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    DeliveryOS
                  </h1>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                    Merchant Console
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
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-xs"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Minimal, Practical Active Outlet Strip */}
        <ActiveOutletStrip
          activeOutlet={activeOutlet}
          outlets={outlets}
          activeOutletId={activeOutletId}
          isMultiBranch={isMultiBranch}
          vendorName={user?.vendorName}
          isCollapsed={isCollapsed}
        />

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
                    ? 'bg-amber-50 text-amber-800 shadow-xs dark:bg-amber-950/50 dark:text-amber-400 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {isCollapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!isCollapsed ? (
          <div className="shrink-0 mt-auto border-t border-slate-100 p-3 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.fullName?.charAt(0) || 'V'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={user?.fullName || undefined}>
                  {user?.fullName || 'Vendor Staff'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={user?.phone || undefined}>
                  {user?.phone || user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors shadow-xs"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>{t('common.logout')}</span>
            </button>
          </div>
        ) : (
          <div className="shrink-0 mt-auto border-t border-slate-100 p-2.5 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-default"
              title={`${user?.fullName || 'Vendor Staff'} (${user?.role})`}
            >
              {user?.fullName?.charAt(0) || 'V'}
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors"
              title={t('common.logout')}
              aria-label={t('common.logout')}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 lg:hidden shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <OutletSwitcher />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {activeOutlet && activeOutlet.id !== 'ALL' && (
              <button
                onClick={() => toggleRushPause()}
                disabled={isTogglingRush}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 h-9 text-xs font-semibold transition-all border shadow-xs ${
                  activeOutlet.isBusy
                    ? 'border-amber-500 bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                } ${isTogglingRush ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={
                  activeOutlet.isBusy
                    ? 'Store is paused. Click to resume incoming customer orders'
                    : 'Rush hour? Click to temporarily pause new incoming orders'
                }
              >
                {activeOutlet.isBusy ? (
                  <>
                    <Flame className="h-3.5 w-3.5 text-slate-950 animate-pulse" />
                    <span>{isTogglingRush ? 'Resuming...' : 'Rush Paused'}</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="hidden sm:inline">{isTogglingRush ? 'Pausing...' : 'Rush Pause'}</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={toggleSound}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 h-9 text-xs font-semibold transition-colors border shadow-xs ${
                isMuted
                  ? 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
              title={isMuted ? 'Click to enable order sound chimes' : 'Sound active. Click to mute'}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">
                {isMuted ? t('kds.audioAlertMuted') : t('kds.audioAlertActive')}
              </span>
            </button>

            <button
              onClick={() => soundEngine.playChime()}
              className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Test chime tone"
              aria-label="Test chime tone"
            >
              <BellRing className="h-4 w-4" />
            </button>

            <LanguageSelector />
          </div>
        </header>

        {/* Emergency Pause Warning Banner */}
        {activeOutlet?.isBusy && (
          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-inner gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Emergency Rush Hour Pause Active for {activeOutlet.name} — Incoming customer orders are temporarily blocked.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleRushPause()}
                disabled={isTogglingRush}
                className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
              >
                {isTogglingRush ? 'Resuming...' : 'Resume Orders Now'}
              </button>
              <Link
                to="/settings"
                className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-slate-950/15 text-xs font-semibold text-slate-950 hover:bg-slate-950/25 transition-colors shadow-xs"
              >
                Manage
              </Link>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm shrink-0">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">DeliveryOS</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Merchant Console
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

              <ActiveOutletStrip
                activeOutlet={activeOutlet}
                outlets={outlets}
                activeOutletId={activeOutletId}
                isMultiBranch={isMultiBranch}
                vendorName={user?.vendorName}
              />

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
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 font-bold'
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
                  <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.fullName?.charAt(0) || 'V'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={user?.fullName || undefined}>
                      {user?.fullName || 'Vendor Staff'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={user?.phone || undefined}>
                      {user?.phone || user?.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors shadow-xs"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const VendorLayout: React.FC = () => {
  return (
    <VendorOutletProvider>
      <VendorLayoutInner />
    </VendorOutletProvider>
  );
};
