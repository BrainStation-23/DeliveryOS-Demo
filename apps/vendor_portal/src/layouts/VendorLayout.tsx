import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChefHat,
  UtensilsCrossed,
  Receipt,
  Store,
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
import { VendorOutletProvider, useVendorOutlet } from '../contexts/VendorOutletContext';
import { OutletSwitcher } from '../components/vendor/OutletSwitcher';
import { LanguageSelector } from '../components/LanguageSelector';
import { SidebarNavList } from '../components/vendor/SidebarNavList';
import { SidebarUserProfile } from '../components/vendor/SidebarUserProfile';
import { soundEngine } from '../utils/sound';
import { useRushPause } from '../hooks/useRushPause';

const VendorLayoutInner: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeOutlet } = useVendorOutlet();
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
    { label: t('nav.vendor.kds'), href: '/', icon: ChefHat },
    { label: t('nav.vendor.catalog'), href: '/catalog', icon: UtensilsCrossed },
    { label: t('nav.vendor.orders'), href: '/orders', icon: Receipt },
    { label: t('nav.vendor.settings'), href: '/settings', icon: Store },
  ];

  const parseUserIdentity = () => {
    const rawName = user?.fullName || 'Vendor Staff';
    const bracketMatch = rawName.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (bracketMatch) {
      return {
        displayName: bracketMatch[1].trim(),
        roleTitle: bracketMatch[2].trim(),
      };
    }
    const fallbackRole =
      user?.outletScope === 'ALL_OUTLETS_MASTER'
        ? t('auth.brandOwner') || 'Brand Owner'
        : user?.role === 'VENDOR_ADMIN'
        ? t('roles.VENDOR_ADMIN') || 'Store Manager'
        : user?.role || 'Staff';
    return {
      displayName: rawName,
      roleTitle: fallbackRole,
    };
  };

  const { displayName, roleTitle } = parseUserIdentity();

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
                  <ChefHat className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    DeliveryOS
                  </h1>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                    {t('common.merchantConsole')}
                  </span>
                </div>
              </div>
              <button
                onClick={toggleCollapse}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title={t('common.collapseSidebar')}
                aria-label={t('common.collapseSidebar')}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleCollapse}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-xs cursor-pointer"
              title={t('common.expandSidebar')}
              aria-label={t('common.expandSidebar')}
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
        </div>

        <SidebarNavList navItems={navItems} isCollapsed={isCollapsed} />

        <SidebarUserProfile
          displayName={displayName}
          roleTitle={roleTitle}
          phone={user?.phone}
          onLogout={logout}
          isCollapsed={isCollapsed}
        />
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-3 sm:px-5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Scoped Outlet Switcher */}
            <div className="min-w-0 max-w-[200px] sm:max-w-[260px] md:max-w-xs">
              <OutletSwitcher />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Rush Hour Emergency Toggle */}
            <button
              type="button"
              disabled={isTogglingRush}
              onClick={() => void toggleRushPause()}
              className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                activeOutlet?.isBusy
                  ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              } ${isTogglingRush ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={
                activeOutlet?.isBusy
                  ? t('kds.rushHourActiveTitle')
                  : t('kds.pauseOrdersTitle')
              }
            >
              {activeOutlet?.isBusy ? (
                <>
                  <PauseCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                  <span className="hidden sm:inline">{t('kds.pausedOrders')}</span>
                  <span className="sm:hidden">{t('kds.paused')}</span>
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline">{t('kds.rushPause')}</span>
                  <span className="sm:hidden">{t('kds.pause')}</span>
                </>
              )}
            </button>

            {/* Sound Alarm Toggle Button */}
            <button
              onClick={toggleSound}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shadow-xs cursor-pointer ${
                isMuted
                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              title={isMuted ? t('common.unmuteSound') : t('common.muteSound')}
              aria-label={isMuted ? t('common.unmuteSound') : t('common.muteSound')}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {/* Global Language Selector */}
            <LanguageSelector />
          </div>
        </header>

        {/* Global Rush Hour Active Emergency Banner */}
        {activeOutlet?.isBusy && (
          <div className="bg-rose-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
              <span>
                {t('kds.rushHourActiveBanner', { name: activeOutlet.name })}
              </span>
            </div>
            <button
              onClick={() => void toggleRushPause()}
              disabled={isTogglingRush}
              className="text-xs bg-white text-rose-700 px-2.5 py-0.5 rounded-md font-bold hover:bg-rose-50 transition-colors shrink-0 shadow-2xs cursor-pointer"
            >
              {t('kds.resumeOrders')}
            </button>
          </div>
        )}

        {/* Audio Muted Indicator Banner */}
        {isMuted && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between z-20">
            <div className="flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t('kds.soundMutedNotice')}</span>
            </div>
            <button
              onClick={toggleSound}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              {t('common.enableSound')}
            </button>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className="flex w-72 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-slate-900 h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm shrink-0">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      DeliveryOS
                    </h2>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {t('common.merchantConsole')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <SidebarNavList
                navItems={navItems}
                onItemClick={() => setIsMobileMenuOpen(false)}
              />

              <SidebarUserProfile
                displayName={displayName}
                roleTitle={roleTitle}
                phone={user?.phone}
                onLogout={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
              />
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
