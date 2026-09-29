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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VendorOutletProvider, useVendorOutlet } from '../contexts/VendorOutletContext';
import { OutletSwitcher } from '../components/vendor/OutletSwitcher';
import { LanguageSelector } from '../components/LanguageSelector';
import { Badge } from '../components/ui/Badge';
import { soundEngine } from '../utils/sound';
import kdsApi from '../services/kdsApi';
import { useRushPause } from '../hooks/useRushPause';

const VendorLayoutInner: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeOutlet } = useVendorOutlet();
  const location = useLocation();
  const [isMuted, setIsMuted] = useState(soundEngine.getIsMuted());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isTogglingRush, toggleRushPause } = useRushPause();

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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex shrink-0">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {activeOutlet?.name || user?.vendorName || 'Merchant Console'}
            </h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Kitchen & Store Ops
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-50 text-amber-800 shadow-sm dark:bg-amber-950/50 dark:text-amber-400 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="mb-3 space-y-1">
            {user?.outletScope === 'ALL_OUTLETS_MASTER' ? (
              <Badge variant="purple" size="sm" className="w-full justify-center">
                Multi-Branch Brand Owner
              </Badge>
            ) : (
              <Badge variant="info" size="sm" className="w-full justify-center">
                Single Outlet Staff
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.fullName?.charAt(0) || 'V'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.fullName}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.phone}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 gap-2">
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
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] text-xs font-bold transition-all border shadow-xs ${
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
              className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] text-xs font-semibold transition-colors border ${
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
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-inner gap-2">
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
                className="rounded-lg bg-slate-950 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                {isTogglingRush ? 'Resuming...' : 'Resume Orders Now'}
              </button>
              <Link
                to="/settings"
                className="rounded-lg bg-slate-950/15 px-2.5 py-1.5 text-slate-950 hover:bg-slate-950/25 transition-colors font-semibold"
              >
                Manage
              </Link>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden shadow-lg">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('common.logout')}</span>
              </button>
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
