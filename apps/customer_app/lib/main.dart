import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/constants/app_colors.dart';
import 'core/localization/app_localizations.dart';
import 'core/localization/language_provider.dart';
import 'core/network/socket_service.dart';
import 'core/notifications/push_notification_service.dart';
import 'core/storage/local_storage.dart';
import 'features/auth/domain/user_model.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/home/presentation/home_screen.dart';
import 'features/splash/presentation/splash_screen.dart';
import 'features/tracking/presentation/order_tracking_screen.dart';


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

final GlobalKey<NavigatorState> customerNavigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _initSentry();
  final localStorage = await LocalStorage.init();

  await PushNotificationService(localStorage).initialize();

  // Notification taps surface in-app: subscribe the home shell once it mounts
  orderNotificationTaps.stream.listen((orderId) {
    final navigator = customerNavigatorKey.currentState;
    if (navigator != null) {
      navigator.push(
        MaterialPageRoute(
          builder: (_) => OrderTrackingScreen(orderId: orderId, orderNumber: ''),
        ),
      );
    }
  });

  runApp(
    ProviderScope(
      overrides: [
        localStorageProvider.overrideWithValue(localStorage),
      ],
      child: const CustomerApp(),
    ),
  );
}

class CustomerApp extends ConsumerStatefulWidget {
  const CustomerApp({super.key});

  @override
  ConsumerState<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends ConsumerState<CustomerApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() {
      ref.read(authProvider.notifier).checkSession();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // The socket gives up after ~10 reconnect attempts; without this hook a
      // backgrounded session loses live order status until full restart.
      final socket = ref.read(socketServiceProvider);
      if (!socket.isConnected) {
        socket.init(ref.read(authProvider).accessToken);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentLocale = ref.watch(languageProvider);
    final authState = ref.watch(authProvider);

    return MaterialApp(
      navigatorKey: customerNavigatorKey,
      title: 'DeliveryOS',
      debugShowCheckedModeBanner: false,
      locale: currentLocale,
      supportedLocales: const [
        Locale('en'),
        Locale('ar'),
        Locale('bn'),
      ],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          primary: AppColors.primary,
          secondary: AppColors.secondary,
          surface: AppColors.background,
        ),
        scaffoldBackgroundColor: AppColors.background,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.white,
          foregroundColor: AppColors.textPrimary,
          elevation: 0,
        ),
      ),
      home: (authState.status == AuthStatus.authenticated ||
              authState.status == AuthStatus.guest)
          ? const HomeScreen()
          : const SplashScreen(),
    );
  }
}
