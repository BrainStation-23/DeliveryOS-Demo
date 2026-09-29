
import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/constants/app_colors.dart';
import 'core/network/socket_service.dart';
import 'core/notifications/push_notification_service.dart';
import 'core/services/background_location_service.dart';
import 'core/storage/local_storage.dart';
import 'features/auth/presentation/pending_approval_screen.dart';
import 'features/auth/presentation/phone_login_screen.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/dashboard/presentation/rider_dashboard_screen.dart';
import 'features/dashboard/providers/duty_provider.dart';

/// Error monitoring activates only when a DSN is injected at build time:
/// --dart-define=SENTRY_DSN=https://...@o0.ingest.sentry.io/0
Future<void> _initSentry() async {
  const dsn = String.fromEnvironment('SENTRY_DSN');
  if (dsn.isEmpty) return;
  await SentryFlutter.init((options) {
    options.dsn = dsn;
    options.environment = kDebugMode ? 'debug' : 'release';
    options.tracesSampleRate = 0;
  });
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _initSentry();
  final localStorage = await LocalStorage.init();

  await BackgroundLocationService.initialize();
  final pushService = PushNotificationService(localStorage);
  await pushService.initialize();

  runApp(
    ProviderScope(
      overrides: [
        localStorageProvider.overrideWithValue(localStorage),
        pushNotificationServiceProvider.overrideWithValue(pushService),
      ],
      child: const DeliveryOSRiderApp(),
    ),
  );
}

/// Overridden with the real service in main(); null in tests/embeds where
/// push is not configured.
final pushNotificationServiceProvider = Provider<PushNotificationService?>((ref) => null);

class DeliveryOSRiderApp extends ConsumerStatefulWidget {
  const DeliveryOSRiderApp({super.key});

  @override
  ConsumerState<DeliveryOSRiderApp> createState() => _DeliveryOSRiderAppState();
}

class _DeliveryOSRiderAppState extends ConsumerState<DeliveryOSRiderApp> with WidgetsBindingObserver {
  StreamSubscription<Map<String, dynamic>>? _pushTapSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _routePushTaps();
  }

  /// Dispatch and trip notifications land on the dashboard, where the socket
  /// broadcast / active-trip state takes over.
  void _routePushTaps() {
    final push = ref.read(pushNotificationServiceProvider);
    if (push == null) return;
    final navigator = Navigator.of(context);
    _pushTapSub = push.taps.listen((data) {
      final type = data['type']?.toString();
      final isDispatchFlow = type == 'DISPATCH_BROADCAST' || type == 'ORDER_ASSIGNED' || type == 'TRIP_CANCELLED';
      if (!isDispatchFlow) return;
      if (!mounted || !ref.read(riderAuthProvider).isAuthenticated) return;
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const RiderDashboardScreen()),
        (route) => false,
      );
    });
    push.initialMessageData.then((data) {
      if (data != null && (data['type']?.toString() == 'DISPATCH_BROADCAST')) {
        if (mounted && ref.read(riderAuthProvider).isAuthenticated) {
          navigator.pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const RiderDashboardScreen()),
            (route) => false,
          );
        }
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pushTapSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Re-establish the realtime socket and GPS beaconing after backgrounding
      final container = ProviderScope.containerOf(context);
      final socket = container.read(riderSocketServiceProvider);
      if (!socket.isConnected) {
        socket.init(container.read(localStorageProvider).getAccessToken());
      }
      final duty = container.read(riderDutyProvider);
      if (duty.isOnline && !duty.isBeaconing) {
        container.read(riderDutyProvider.notifier).toggleDuty(forceState: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(riderAuthProvider);

    return MaterialApp(
      title: 'DeliveryOS Rider',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          primary: AppColors.primary,
          secondary: AppColors.secondary,
          surface: AppColors.card,
        ),
        scaffoldBackgroundColor: AppColors.background,
      ),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', ''),
        Locale('bn', ''),
        Locale('ar', ''),
      ],
      home: _resolveInitialScreen(authState),
    );
  }

  Widget _resolveInitialScreen(RiderAuthState authState) {
    if (authState.isAuthenticated) {
      return const RiderDashboardScreen();
    }
    if (authState.isPendingApproval) {
      return const PendingApprovalScreen();
    }
    return const PhoneLoginScreen();
  }
}
