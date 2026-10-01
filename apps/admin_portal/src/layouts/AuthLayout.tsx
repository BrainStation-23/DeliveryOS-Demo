import React from 'react';
import { Outlet } from 'react-router-dom';
import { LanguageSelector } from '../components/LanguageSelector';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex flex-col">
      {/* Header with language switcher */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center font-bold text-white shadow-lg shadow-primary-500/30">
            D
          </div>
          <span className="font-extrabold text-lg tracking-tight">DeliveryOS</span>
        </div>
        <LanguageSelector variant="dark" />
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500">
        DeliveryOS Enterprise Logistics Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
