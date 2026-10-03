# 06 — Frontend & Mobile Architecture

Client-side architectures, directory layouts, native device handoffs, state management, and audio synthesis specifications for Flutter mobile apps and React 18 SPAs.

---

## 1. Flutter Mobile Architecture (Customer & Rider Apps)

Built on **Flutter (Dart ^3.8)** using a **Feature-First Clean Architecture** with **Riverpod 3** for reactive state management.

### 1.1 Customer App Architecture (`apps/customer_app`)

```
apps/customer_app/lib/
├── core/
│   ├── constants/           # Colors, assets, typography, API constants
│   ├── network/             # Dio client, JWT auth interceptor, retry interceptor
│   ├── localization/        # In-code localized string lookups & LanguageNotifier
│   ├── storage/             # SharedPreferences local storage wrapper
│   └── utils/               # Native dialer launcher, currency formatters
└── features/
    ├── addresses/           # AddressBookScreen, AddressNotifier, CustomerAddressModel
    ├── auth/                # PhoneInputScreen, OtpVerificationScreen, AuthProvider
    ├── banners/             # BannerCarousel, PromoBannerModel
    ├── cart/                # CartScreen, CartNotifier, Guarded Checkout
    ├── discovery/           # SearchScreen, SearchNotifier, CategoryChips
    ├── home/                # HomeScreen, NearbyVendorsFeed, Sticky Category Bar
    ├── location/            # MapLocationPickerScreen, LocationNotifier
    ├── orders/              # OrderHistoryScreen, SmartReorderNotifier
    ├── profile/             # ProfileScreen, CustomerProfileNotifier
    ├── store/               # OutletDetailScreen, ItemCustomizerSheet, ProductCatalogModel
    └── tracking/            # OrderTrackingScreen, OrderStepperWidget, LiveMap
```

### 1.2 Rider App Architecture (`apps/rider_app`)

```
apps/rider_app/lib/
├── core/
│   ├── constants/           # AppColors, ApiConstants, Typography
│   ├── network/             # Dio client with JWT interceptor & refresh handling
│   ├── services/            # RiderSocketService (Socket.IO client for dispatch & telemetry)
│   ├── storage/             # Secure SharedPreferences storage provider
│   └── utils/               # Native turn-by-turn navigation & phone dialer handoffs
└── features/
    ├── auth/                # PhoneLoginScreen, OtpVerificationScreen, PendingApprovalScreen
    ├── dashboard/           # RiderDashboardScreen, RiderDutyNotifier, TelemetryBeacon
    ├── earnings/            # RiderEarningsScreen, TimeframeToggle, CashDepositModal
    └── trips/               # ActiveTripScreen (3-Step Stepper), IncomingTripModal (45s Chime),
                             # Doorstep Unresponsive SOP Modal (5-min Countdown)
```

### 1.3 Native Device Handoffs & Telemetry

```dart
// 1. Direct Native Phone Calling
Future<void> makeDirectPhoneCall(String phoneNumber) async {
  final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
  if (await canLaunchUrl(launchUri)) {
    await launchUrl(launchUri);
  }
}

// 2. Native Turn-by-Turn Navigation Handoff (Google Maps / Apple Maps)
Future<void> openNativeTurnByTurnNavigation(double lat, double lng) async {
  final Uri googleMapsUri = Uri.parse('google.navigation:q=$lat,$lng&mode=d');
  final Uri appleMapsUri = Uri.parse('https://maps.apple.com/?daddr=$lat,$lng');

  if (Platform.isAndroid && await canLaunchUrl(googleMapsUri)) {
    await launchUrl(googleMapsUri);
  } else if (await canLaunchUrl(appleMapsUri)) {
    await launchUrl(appleMapsUri);
  }
}
```

- **Foreground Telemetry Service**: Configured in `AndroidManifest.xml` via `FOREGROUND_SERVICE_LOCATION`, streaming 10-meter GPS updates via WebSockets when in the background.

### 1.4 Secure Token Storage & Mobile Release Engineering (ADR-013, ADR-015)
- **Token Security**: JWT tokens are persisted via `flutter_secure_storage` (Android Keystore / iOS Keychain) with automatic transparent migration from legacy SharedPreferences.
- **Single-Flight Refresh Interceptor**: Intercepts 401s, executes single-flight token rotation via `POST /auth/refresh`, and replays failed queries or triggers logout.
- **Release Signing & ProGuard**: Configured via `android/key.properties` (gitignored; debug keystore fallback for contributors) with ProGuard rules referenced.
- **Release Packaging**: `scripts/build-android.sh` produces release Android App Bundles (AAB) with dart-define injected base URLs, Maps keys, and payment gateways (`TID-07 § 6`).
- **Error Monitoring**: Sentry Flutter captures fatal errors and unhandled exceptions, wired with `--dart-define=SENTRY_DSN`.

---

## 2. React 18 SPA Architecture (Admin & Vendor Portals)

Two independent Single Page Applications built with **Vite**, **React 18**, **Tailwind CSS**, and **TanStack Query** behind Nginx subpath routing ([ADR-005](../architecture-decision-records/ADR-005-micro-frontends-and-subpath-routing.md)):

```
apps/
├── admin_portal/src/
│   ├── config/adminNavigation.ts     # Canonical nav contract: 9 routes, Lucide icons, titles, aliases
│   ├── components/
│   │   ├── dispatch/LiveFleetMap.tsx # Leaflet OpenStreetMap interactive radar
│   │   ├── finance/                  # FinanceLedgerSection, CashDepositsSection
│   │   └── ui/                       # Table (paginated), Modal, Drawer, StatCard, Badge, Button
│   ├── pages/admin/
│   │   ├── AdminDashboardPage.tsx    # Live operational KPIs & recent orders feed
│   │   ├── AdminFleetPage.tsx        # Fleet Radar, Applicant Couriers queue, Cash Limits (/fleet)
│   │   ├── AdminOrdersPage.tsx       # Order monitor, ?orderNumber deep link, override modals
│   │   ├── AdminVendorsPage.tsx      # Brands & Outlets Governance, Brand cards, Staff Registry
│   │   ├── AdminOutletPage.tsx       # Outlet details, category/product catalog, hours grid
│   │   ├── AdminCustomersPage.tsx    # Customer directory, lifetime value metrics, address drawer
│   │   ├── AdminPromotionsPage.tsx   # Hero banner scheduler & promo coupon engine
│   │   ├── AdminMediaPage.tsx        # Central Media Library, client-side cropper & presets
│   │   ├── AdminFinancePage.tsx      # Per-order ledger, vendor settlement cycles, CSV export
│   │   └── AdminSettingsPage.tsx     # Order flow FSM, delivery fee mode, economics, cash deposits
│   ├── routes/AppRoutes.tsx          # RBAC RouteGuard enforcing SUPER_ADMIN with lazy code splitting
│   ├── stores/useAuthStore.ts        # Zustand auth session store
│   └── services/adminApi.ts          # Axios client for /api/v1/admin/*
│
└── vendor_portal/src/
    ├── config/vendorNavigation.ts    # Canonical nav contract: 4 routes, Lucide icons, titles, aliases
    ├── components/
    │   ├── kds/                      # KDSOrderCard, CountdownTimer (amber->red overdue)
    │   ├── vendor/OutletSwitcher.tsx # Multi-branch Brand Owner vs Single-Store staff switch
    │   └── ui/                       # Table (paginated), high-contrast culinary UI components
    ├── pages/vendor/
    │   ├── VendorDashboardPage.tsx   # 3-lane KDS Kanban board with audio chime
    │   ├── VendorCatalogPage.tsx     # Merchant catalog retaining sold-out items with stock toggles
    │   ├── VendorOrdersPage.tsx      # Itemized sales ledger, paginated receipts, details modal
    │   └── VendorSettingsPage.tsx    # Emergency pause (30m, 1h, Day), prep time, 7-day schedule
    ├── hooks/useKDSOrders.ts         # TanStack Query + Socket.IO invalidation + persistent chime
    ├── utils/sound.ts                # Web Audio API in-memory oscillator chime (ADR-007)
    ├── routes/AppRoutes.tsx          # RBAC RouteGuard enforcing VENDOR_ADMIN
    └── services/kdsApi.ts            # Axios client for /api/v1/vendor/*
```

### 2.1 Role-Based Access Control (RBAC) Route Registries

```tsx
// admin_portal/src/routes/AppRoutes.tsx:
<Route element={<RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}><AdminLayout /></RoleGuard>}>
  <Route path="/" element={<AdminDashboardPage />} />
  <Route path="/dashboard" element={<AdminDashboardPage />} />
  <Route path="/vendors" element={<AdminVendorsPage />} />
  <Route path="/outlets/:outletId" element={<AdminOutletPage />} />
  <Route path="/fleet" element={<AdminFleetPage />} />
  <Route path="/dispatch" element={<Navigate to="/fleet" replace />} />
  <Route path="/orders" element={<AdminOrdersPage />} />
  <Route path="/customers" element={<AdminCustomersPage />} />
  <Route path="/promotions" element={<AdminPromotionsPage />} />
  <Route path="/media" element={<AdminMediaPage />} />
  <Route path="/finance" element={<AdminFinancePage />} />
  <Route path="/settings" element={<AdminSettingsPage />} />
</Route>

// vendor_portal/src/routes/AppRoutes.tsx:
<Route element={<RoleGuard allowedRoles={[UserRole.VENDOR_ADMIN]}><VendorLayout /></RoleGuard>}>
  <Route path="/" element={<VendorDashboardPage />} />
  <Route path="/kds" element={<VendorDashboardPage />} />
  <Route path="/catalog" element={<VendorCatalogPage />} />
  <Route path="/orders" element={<VendorOrdersPage />} />
  <Route path="/settings" element={<VendorSettingsPage />} />
</Route>
```

### 2.2 Synthesized Kitchen Audio Alert Engine (ADR-007)

```typescript
// apps/vendor_portal/src/utils/sound.ts
export function playOrderAlarmChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dual-tone harmonic bells (D5 587.33 Hz + A5 880 Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.25);
    osc2.stop(ctx.currentTime + 1.25);
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}
```

- **Silence Invariant**: `useKDSOrders.ts` triggers this sound every 3 seconds while new orders exist in Lane 1, stopping strictly when all orders have been accepted or rejected.

### 2.3 Live Fleet Radar Engine (Leaflet OSM)

- Implemented in `apps/admin_portal/src/components/dispatch/LiveFleetMap.tsx`.
- Custom `DivIcon` markers styled with Tailwind: Emerald (Idle), Sky (Delivering), Amber ($\ge 80\%$ Cash Limit), Slate (Offline).
- Marker popups provide direct SPA navigation links (`navigate('/orders?orderNumber=...')`), preserving active WebSocket connections.

### 2.4 Code Splitting & Sentry Error Boundaries (ADR-014)
- **Route-Level Lazy Loading**: Both React SPAs employ `React.lazy` with Suspense fallbacks across all top-level routes, dramatically optimizing initial payload weight.
- **Vendor Chunking**: Vite builds separate large third-party dependencies (`@tanstack/react-query`, `leaflet`, `lucide-react`) into standalone cacheable chunks via `manualChunks`.
- **Error Boundaries**: Every screen is guarded by Sentry error boundaries (`@sentry/react`) wrapping fallback UI primitives and capturing unexpected runtime render exceptions with request-id context.
