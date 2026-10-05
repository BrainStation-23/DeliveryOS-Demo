import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/cart/domain/cart_item_model.dart';
import 'package:customer_app/features/cart/presentation/cart_screen.dart';
import 'package:customer_app/features/cart/providers/cart_provider.dart';
import 'package:customer_app/features/store/domain/store_catalog_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  final sampleProduct = ProductModel(
    id: 'prod-001',
    name: 'Kacchi Biryani',
    description: 'Fresh mutton biryani',
    basePrice: 450.0,
    unitType: 'portion',
    isInStock: true,
  );

  final sampleCartItem = CartItem(
    product: sampleProduct,
    quantity: 1,
    unitPrice: 450.0,
  );

  group('T14: Checkout Coverage Gating Domain Invariants', () {
    test('canCheckout is false when cart is empty', () {
      final state = CartState(items: []);
      expect(state.canCheckout, isFalse);
    });

    test('canCheckout is strictly false while coverage verification is pending (isCheckingCoverage == true)', () {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: true, // Coverage resolution in-flight
        isWithinCoverage: true,
      );
      expect(state.canCheckout, isFalse);
    });

    test('canCheckout is strictly false when address is outside delivery coverage', () {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: false,
        isWithinCoverage: false, // Out of coverage
      );
      expect(state.canCheckout, isFalse);
    });

    test('canCheckout is true when within coverage and coverage resolution is complete', () {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: false,
        isWithinCoverage: true,
      );
      expect(state.canCheckout, isTrue);
    });

    test('canCheckout allows takeaway even if outside home delivery coverage', () {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.takeaway,
        isCheckingCoverage: false,
        isWithinCoverage: false,
      );
      expect(state.canCheckout, isTrue);
    });

    test('canCheckout is false when store is inactive or busy', () {
      final inactiveState = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        isVendorActive: false,
      );
      expect(inactiveState.canCheckout, isFalse);

      final busyState = CartState(
        vendorId: 'v-1',
        vendorName: 'Sultan Dine',
        items: [sampleCartItem],
        isVendorBusy: true,
      );
      expect(busyState.canCheckout, isFalse);
    });
  });

  group('T14: CartScreen Coverage Gating UI', () {
    Widget buildTestApp(CartState state) {
      return ProviderScope(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          cartProvider.overrideWith(() => _StaticCartNotifier(state)),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: [Locale('en')],
          home: CartScreen(),
        ),
      );
    }

    testWidgets('Checkout button is disabled and displays pending text during coverage verification', (tester) async {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: "Sultan's Dine - Banani",
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: true,
        isWithinCoverage: false,
      );

      await tester.pumpWidget(buildTestApp(state));
      await tester.pumpAndSettle();

      final buttonFinder = find.widgetWithText(ElevatedButton, 'Verifying Delivery Coverage...');
      expect(buttonFinder, findsOneWidget);

      final button = tester.widget<ElevatedButton>(buttonFinder);
      expect(button.onPressed, isNull); // Disabled
    });

    testWidgets('Checkout button is disabled and displays out-of-coverage warning when address is outside radius',
        (tester) async {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: "Sultan's Dine - Banani",
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: false,
        isWithinCoverage: false,
        coverageError: 'Address is outside 5 km radius',
      );

      await tester.pumpWidget(buildTestApp(state));
      await tester.pumpAndSettle();

      final buttonFinder = find.widgetWithText(ElevatedButton, 'Address Out of Coverage');
      expect(buttonFinder, findsOneWidget);

      final button = tester.widget<ElevatedButton>(buttonFinder);
      expect(button.onPressed, isNull); // Disabled
    });

    testWidgets('Checkout button is enabled when address is verified within coverage', (tester) async {
      final state = CartState(
        vendorId: 'v-1',
        vendorName: "Sultan's Dine - Banani",
        items: [sampleCartItem],
        deliveryMethod: DeliveryMethod.homeDelivery,
        isCheckingCoverage: false,
        isWithinCoverage: true,
      );

      await tester.pumpWidget(buildTestApp(state));
      await tester.pumpAndSettle();

      final buttonFinder = find.widgetWithText(ElevatedButton, 'Place Order (1 items)');
      expect(buttonFinder, findsOneWidget);

      final button = tester.widget<ElevatedButton>(buttonFinder);
      expect(button.onPressed, isNotNull); // Enabled
    });
  });
}

class _StaticCartNotifier extends CartNotifier {
  final CartState _initial;
  _StaticCartNotifier(this._initial);

  @override
  CartState build() => _initial;
}
