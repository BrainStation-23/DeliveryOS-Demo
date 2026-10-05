import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/auth/domain/user_model.dart';
import 'package:customer_app/features/auth/presentation/otp_verification_screen.dart';
import 'package:customer_app/features/auth/presentation/phone_input_screen.dart';
import 'package:customer_app/features/auth/providers/auth_provider.dart';
import 'package:customer_app/features/banners/presentation/banner_carousel.dart';
import 'package:customer_app/features/home/presentation/widgets/outlet_card.dart';
import 'package:customer_app/features/location/domain/nearby_vendor_model.dart';
import 'package:customer_app/features/orders/presentation/order_history_screen.dart';
import 'package:customer_app/features/profile/presentation/profile_screen.dart';
import 'package:customer_app/features/tracking/domain/tracking_models.dart';
import 'package:customer_app/features/tracking/presentation/widgets/order_stepper_widget.dart';
import 'package:customer_app/features/tracking/presentation/widgets/payment_recovery_banner.dart';
import '../mock_dio_client.dart';

class _TestAuthNotifier extends AuthNotifier {
  @override
  AuthState build() => AuthState(
        status: AuthStatus.authenticated,
        accessToken: 'test-token',
        user: UserModel(
          id: 'u-1',
          phone: '+8801700000001',
          fullName: 'Tanvir Ahmed Shanto',
          role: 'CUSTOMER',
        ),
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      'auth_access_token': 'test-token',
      'cached_user_profile':
          '{"id":"u-1","phone":"+8801700000001","name":"Tanvir Ahmed Shanto","role":"CUSTOMER"}',
    });
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  Widget buildConstrainedApp({
    required Widget child,
    ProviderContainer? container,
    double width = 320.0,
    double height = 568.0,
    double textScale = 1.5,
  }) {
    final rootWidget = MediaQuery(
      data: MediaQueryData(
        size: Size(width, height),
        textScaler: TextScaler.linear(textScale),
        viewInsets: EdgeInsets.zero,
        padding: const EdgeInsets.only(top: 20, bottom: 20),
      ),
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('bn')],
        home: Scaffold(
          body: SizedBox(
            width: width,
            height: height,
            child: child,
          ),
        ),
      ),
    );

    if (container != null) {
      return UncontrolledProviderScope(
        container: container,
        child: rootWidget,
      );
    }

    return ProviderScope(
      overrides: [
        localStorageProvider.overrideWithValue(storage),
        dioClientProvider.overrideWithValue(createTestMockDioClient()),
        authProvider.overrideWith(() => _TestAuthNotifier()),
      ],
      child: rootWidget,
    );
  }

  void configureTesterConstraints(WidgetTester tester, {double width = 320.0, double height = 568.0}) {
    tester.view.physicalSize = Size(width, height);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
  }

  group('UI Responsiveness & Layout Constraint Verification (320px & 1.5x Font Scale)', () {
    testWidgets('PhoneInputScreen renders cleanly without RenderFlex overflow', (tester) async {
      configureTesterConstraints(tester);

      await tester.pumpWidget(
        buildConstrainedApp(
          child: const PhoneInputScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Enter Your Phone Number'), findsOneWidget);
      expect(find.text('Demo Customer: +8801700000005'), findsOneWidget);
    });

    testWidgets('OtpVerificationScreen renders pin inputs without overflow', (tester) async {
      configureTesterConstraints(tester);

      await tester.pumpWidget(
        buildConstrainedApp(
          child: const OtpVerificationScreen(
            phoneNumber: '+8801700000001',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Verify Phone Number'), findsOneWidget);
      expect(find.text('Verify & Login'), findsOneWidget);
    });

    testWidgets('OrderStepperWidget renders all 6 stages at 320px with 1.5x scale without overflow', (tester) async {
      configureTesterConstraints(tester);

      await tester.pumpWidget(
        buildConstrainedApp(
          child: const SingleChildScrollView(
            child: OrderStepperWidget(currentStage: OrderStage.dispatched),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Courier on the Way'), findsOneWidget);
    });

    testWidgets('PaymentRecoveryBanner wraps action buttons without overflow', (tester) async {
      configureTesterConstraints(tester);

      await tester.pumpWidget(
        buildConstrainedApp(
          child: SingleChildScrollView(
            child: PaymentRecoveryBanner(
              onSwitchToCOD: () {},
              onRefresh: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Online Payment Pending'), findsOneWidget);
      expect(find.text('Switch to Cash (COD)'), findsOneWidget);
      expect(find.text('Refresh'), findsOneWidget);
    });

    testWidgets('OutletCard renders meta badges with Wrap without overflow', (tester) async {
      configureTesterConstraints(tester);

      const mockVendor = NearbyVendor(
        id: 'v-101',
        name: 'The Great Himalayan Kitchen and Premium Kacchi Ghor',
        typeSlug: 'restaurant',
        addressText: 'Plot 45, Road 11, Block C, Banani Commercial Area, Dhaka',
        latitude: 23.7937,
        longitude: 90.4066,
        deliveryRadiusKm: 8.5,
        defaultPrepTimeMinutes: 35,
        isActive: true,
        isBusy: false,
        distanceKm: 2.4,
        deliveryFee: 60.0,
      );

      await tester.pumpWidget(
        buildConstrainedApp(
          child: const SingleChildScrollView(
            child: OutletCard(vendor: mockVendor),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('The Great Himalayan Kitchen'), findsOneWidget);
      expect(find.text('2.4 km'), findsOneWidget);
      expect(find.text('35 min'), findsOneWidget);
    });

    testWidgets('BannerCarousel renders at 320px with 1.5x scale without overflow', (tester) async {
      configureTesterConstraints(tester);

      await tester.pumpWidget(
        buildConstrainedApp(
          child: const BannerCarousel(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('50% OFF Biryani Feast'), findsOneWidget);
    });

    testWidgets('OrderHistoryScreen renders past orders at 320px with 1.5x scale', (tester) async {
      configureTesterConstraints(tester);

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
          authProvider.overrideWith(() => _TestAuthNotifier()),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        buildConstrainedApp(
          container: container,
          child: const OrderHistoryScreen(),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('My Orders'), findsOneWidget);
      expect(find.text('Track Order'), findsWidgets);
      expect(find.text('Re-order'), findsWidgets);
    });

    testWidgets('ProfileScreen renders at 320px with 1.5x scale without overflow', (tester) async {
      configureTesterConstraints(tester);

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
          authProvider.overrideWith(() => _TestAuthNotifier()),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        buildConstrainedApp(
          container: container,
          child: const ProfileScreen(),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('My Profile & Account'), findsOneWidget);
      expect(find.text('TOTAL ORDERS'), findsOneWidget);
      expect(find.text('SAVED ADDRESSES'), findsOneWidget);
      expect(find.text('Saved Delivery Addresses'), findsOneWidget);
    });
  });
}
