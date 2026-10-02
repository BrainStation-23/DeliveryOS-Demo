import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '../types/auth';
import { RoleGuard } from './RoleGuard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Layouts
import { AdminLayout } from '../layouts/AdminLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Eager: shell + auth pages
import { LoginPage } from '../pages/auth/LoginPage';
import { UnauthorizedPage } from '../pages/common/UnauthorizedPage';
import { NotFoundPage } from '../pages/common/NotFoundPage';

// Lazy: feature pages (route-level code splitting)
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminFleetPage = lazy(() =>
  import('../pages/admin/AdminFleetPage').then((m) => ({ default: m.AdminFleetPage })),
);
const AdminOrdersPage = lazy(() =>
  import('../pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })),
);
const AdminPromotionsPage = lazy(() =>
  import('../pages/admin/AdminPromotionsPage').then((m) => ({ default: m.AdminPromotionsPage })),
);
const AdminVendorsPage = lazy(() =>
  import('../pages/admin/AdminVendorsPage').then((m) => ({ default: m.AdminVendorsPage })),
);
const AdminSettingsPage = lazy(() =>
  import('../pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
);
const AdminFinancePage = lazy(() =>
  import('../pages/admin/AdminFinancePage').then((m) => ({ default: m.AdminFinancePage })),
);
const AdminMediaPage = lazy(() =>
  import('../pages/admin/AdminMediaPage').then((m) => ({ default: m.AdminMediaPage })),
);
const AdminOutletPage = lazy(() =>
  import('../pages/admin/AdminOutletPage').then((m) => ({ default: m.AdminOutletPage })),
);
const AdminCustomersPage = lazy(() =>
  import('../pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })),
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

        {/* Super Admin Protected Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}>
              <AdminLayout />
            </RoleGuard>
          }
        >
          <Route path="/" element={<AdminDashboardPage />} />
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboardPage />} />
          <Route path="/vendors" element={<AdminVendorsPage />} />
          <Route path="/outlets/:outletId" element={<AdminOutletPage />} />
          <Route path="/fleet" element={<AdminFleetPage />} />
          <Route path="/dispatch" element={<Navigate to="/fleet" replace />} />
          <Route path="/orders" element={<AdminOrdersPage />} />
          <Route path="/promotions" element={<AdminPromotionsPage />} />
          <Route path="/customers" element={<AdminCustomersPage />} />
          <Route path="/media" element={<AdminMediaPage />} />
          <Route path="/finance" element={<AdminFinancePage />} />
          <Route path="/financial-governance" element={<Navigate to="/finance" replace />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
