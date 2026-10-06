import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/auth/domain/user_model.dart';
import 'package:customer_app/features/auth/presentation/phone_input_screen.dart';
import 'package:customer_app/features/auth/providers/auth_provider.dart';
import 'package:customer_app/features/home/presentation/home_screen.dart';
import 'package:customer_app/features/location/domain/user_location.dart';
import 'package:customer_app/features/location/presentation/map_location_picker_screen.dart';
import 'package:customer_app/features/location/providers/location_provider.dart';
import 'package:customer_app/features/splash/presentation/splash_screen.dart';
import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Trilingual Localization & RTL', () {
    test('English translations exist and isRtl is false', () {
      final l10n = AppLocalizations(const Locale('en'));
      expect(l10n.translate('app_title'), 'DeliveryOS');
      expect(l10n.translate('tagline'), contains('Fast'));
      expect(l10n.translate('home'), 'Home');
      expect(l10n.isRtl, isFalse);
    });

    test('Arabic translations exist and isRtl is true', () {
      final l10n = AppLocalizations(const Locale('ar'));
      expect(l10n.translate('app_title'), 'ديليفري أو إس');
      expect(l10n.translate('tagline'), contains('سريع'));
      expect(l10n.translate('home'), 'المنزل');
      expect(l10n.isRtl, isTrue);
    });

    test('Bengali translations exist and isRtl is false', () {
      final l10n = AppLocalizations(const Locale('bn'));
      expect(l10n.translate('app_title'), 'ডেলিভারি ওএস');
      expect(l10n.translate('tagline'), contains('দ্রুত'));
      expect(l10n.translate('home'), 'বাসা');
      expect(l10n.isRtl, isFalse);
    });
  });

  group('Auth & Guest Mode Providers', () {
    late LocalStorage storage;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      storage = LocalStorage(prefs);
    });

    test('Universal dev OTP 123456 logs in successfully', () async {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
        ],
      );

      final authNotifier = container.read(authProvider.notifier);
      expect(container.read(authProvider).status, AuthStatus.initial);

      // Verify OTP with universal dev OTP 123456
      final success = await authNotifier.verifyOtp('+8801700000005', '123456');
      expect(success, isTrue);

      final state = container.read(authProvider);
      expect(state.status, AuthStatus.authenticated);
      expect(state.isAuthenticated, isTrue);
      expect(state.user?.phone, '+8801700000005');
      expect(storage.getAccessToken(), isNotNull);
    });

    test('Frictionless Guest Mode sets guest status and clears on logout', () async {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
        ],
      );

      final authNotifier = container.read(authProvider.notifier);
      await authNotifier.continueAsGuest();

      expect(container.read(authProvider).status, AuthStatus.guest);
      expect(container.read(authProvider).isGuest, isTrue);
      expect(storage.isGuest(), isTrue);

      await authNotifier.logout();
      expect(container.read(authProvider).status, AuthStatus.unauthenticated);
      expect(storage.isGuest(), isFalse);
    });
  });

  group('Location Selection & Dhaka Pilot Neighborhoods', () {
    late LocalStorage storage;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      storage = LocalStorage(prefs);
    });

    test('Default location is Banani Road 11', () {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
        ],
      );

      final loc = container.read(locationProvider).location;
      expect(loc.latitude, 23.7925);
      expect(loc.longitude, 90.4078);
      expect(loc.addressLine, contains('Banani'));
      expect(loc.addressType, AddressType.home);
    });

    test('Setting coordinates updates location, reverse geocodes, and saves to storage', () async {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
        ],
      );

      final notifier = container.read(locationProvider.notifier);

      // Select Gulshan 1
      await notifier.setCoordinates(23.7780, 90.4180);
      var state = container.read(locationProvider);
      expect(state.location.latitude, 23.7780);
      expect(state.location.longitude, 90.4180);
      expect(state.location.addressLine, contains('Gulshan'));

      // Select Dhanmondi
      await notifier.setCoordinates(23.7465, 90.3760);
      state = container.read(locationProvider);
      expect(state.location.latitude, 23.7465);
      expect(state.location.longitude, 90.3760);
      expect(state.location.addressLine, contains('Dhanmondi'));

      // Address Type Switch
      notifier.setAddressType(AddressType.work);
      state = container.read(locationProvider);
      expect(state.location.addressType, AddressType.work);

      // Verify persistent storage
      final saved = storage.getSavedLocation();
      expect(saved, isNotNull);
      expect(saved!['addressType'], 'work');
    });
  });

  group('Core Widget UI Flows', () {
    late LocalStorage storage;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      storage = LocalStorage(prefs);
    });

    Widget createTestApp({required Widget child, Locale? locale}) {
      return ProviderScope(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
        ],
        child: MaterialApp(
          locale: locale ?? const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en'),
            Locale('ar'),
            Locale('bn'),
          ],
          home: child,
        ),
      );
    }

    testWidgets('SplashScreen renders trilingual switcher and guest button',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(child: const SplashScreen()));
      await tester.pumpAndSettle();

      expect(find.text('DeliveryOS'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
      expect(find.text('العربية'), findsOneWidget);
      expect(find.text('বাংলা'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);
      expect(find.text('Explore as Guest'), findsOneWidget);
    });

    testWidgets('PhoneInputScreen renders country code and quick fill dev chip',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(child: const PhoneInputScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Enter Your Phone Number'), findsOneWidget);
      expect(find.text('🇧🇩 +880'), findsOneWidget);
      expect(find.text('Demo Customer: +8801700000005'), findsOneWidget);
      expect(find.text('Send Verification Code'), findsOneWidget);

      // Tap demo quick fill chip
      await tester.tap(find.text('Demo Customer: +8801700000005'));
      await tester.pumpAndSettle();

      expect(find.text('1700000005'), findsOneWidget);
    });

    testWidgets('MapLocationPickerScreen renders neighborhood presets and address types',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(child: const MapLocationPickerScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Choose Delivery Location'), findsOneWidget);
      expect(find.text('Banani (Road 11)'), findsOneWidget);
      expect(find.text('Gulshan 1'), findsOneWidget);
      expect(find.text('Dhanmondi'), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Work'), findsOneWidget);
      expect(find.text('Other'), findsOneWidget);
      expect(find.text('Confirm Delivery Address'), findsOneWidget);

      // Tap Gulshan 1 preset
      await tester.tap(find.text('Gulshan 1'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Gulshan'), findsWidgets);
    });

    testWidgets('HomeScreen displays delivering address in top bar and opens map on tap',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(child: const HomeScreen()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.place_rounded), findsOneWidget);
      expect(find.text('Delivering To'), findsOneWidget);
      expect(find.textContaining('Banani'), findsWidgets);
      expect(find.text("Sultan's Dine - Banani"), findsOneWidget);
      expect(find.text('Kacchi Bhai - Gulshan 1'), findsOneWidget);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -250));
      await tester.pumpAndSettle();

      expect(find.text('Shwapno Superstore Express'), findsOneWidget);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 250));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.place_rounded));
      await tester.pumpAndSettle();
      expect(find.byType(MapLocationPickerScreen), findsOneWidget);
    });
  });
}
