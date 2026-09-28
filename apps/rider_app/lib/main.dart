import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final localStorage = LocalStorage(prefs);

  await BackgroundLocationService.initialize();
  await PushNotificationService(localStorage).initialize();

  runApp(
    ProviderScope(
      overrides: [
        localStorageProvider.overrideWithValue(localStorage),
      ],
      child: const DeliveryOSRiderApp(),
    ),
  );
}

class DeliveryOSRiderApp extends ConsumerStatefulWidget {
  const DeliveryOSRiderApp({super.key});

  @override
  ConsumerState<DeliveryOSRiderApp> createState() => _DeliveryOSRiderAppState();
}

class _DeliveryOSRiderAppState extends ConsumerState<DeliveryOSRiderApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
