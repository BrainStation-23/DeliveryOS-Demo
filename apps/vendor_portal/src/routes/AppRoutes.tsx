import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { UserRole } from '../types/auth';
import { RoleGuard } from './RoleGuard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Layouts
import { VendorLayout } from '../layouts/VendorLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Eager: shell + auth pages
import { LoginPage } from '../pages/auth/LoginPage';
import { UnauthorizedPage } from '../pages/common/UnauthorizedPage';
import { NotFoundPage } from '../pages/common/NotFoundPage';

// Lazy: feature pages (route-level code splitting)
const VendorDashboardPage = lazy(() =>
  import('../pages/vendor/VendorDashboardPage').then((m) => ({ default: m.VendorDashboardPage })),
);
const VendorCatalogPage = lazy(() =>
  import('../pages/vendor/VendorCatalogPage').then((m) => ({ default: m.VendorCatalogPage })),
);
const VendorSettingsPage = lazy(() =>
  import('../pages/vendor/VendorSettingsPage').then((m) => ({ default: m.VendorSettingsPage })),
);
const VendorOrdersPage = lazy(() =>
  import('../pages/vendor/VendorOrdersPage').then((m) => ({ default: m.VendorOrdersPage })),
);

const RouteFallback: React.FC = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <LoadingSpinner size="lg" label="Loading module..." />
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Auth Public Pages */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Access Denied */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Vendor Staff & Merchant Protected Routes (Strictly VENDOR_ADMIN) */}
        <Route
          element={
            <RoleGuard allowedRoles={[UserRole.VENDOR_ADMIN]}>
              <VendorLayout />
            </RoleGuard>
          }
        >
          <Route path="/" element={<VendorDashboardPage />} />
          <Route path="/kds" element={<VendorDashboardPage />} />
          <Route path="/catalog" element={<VendorCatalogPage />} />
          <Route path="/orders" element={<VendorOrdersPage />} />
          <Route path="/settings" element={<VendorSettingsPage />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
