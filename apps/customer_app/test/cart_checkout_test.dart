import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/network/dio_client.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/cart/domain/cart_item_model.dart';
import 'package:customer_app/features/cart/presentation/cart_screen.dart';
import 'package:customer_app/features/cart/providers/cart_provider.dart';
import 'package:customer_app/features/store/domain/store_catalog_model.dart';
import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  final sampleProduct1 = ProductModel(
    id: 'prod-kacchi',
    name: 'Kacchi Biryani',
    description: 'Fragrant mutton biryani',
    basePrice: 420.0,
    unitType: 'portion',
    isInStock: true,
  );

  final sampleProduct2 = ProductModel(
    id: 'prod-burger',
    name: 'Smoky Beef Burger',
    description: 'Juicy beef patty with cheese',
    basePrice: 280.0,
    unitType: 'piece',
    isInStock: true,
  );

  Widget createTestWidget({required Widget child, ProviderContainer? container}) {
    return UncontrolledProviderScope(
      container: container ??
          ProviderContainer(
            overrides: [
              localStorageProvider.overrideWithValue(storage),
            ],
          ),
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        home: child,
      ),
    );
  }

  group('Cart Single-Outlet Invariant', () {
    test('Cart enforces single outlet and guards cross-vendor additions', () {
      final container = ProviderContainer(
        overrides: [localStorageProvider.overrideWithValue(storage)],
      );

      final notifier = container.read(cartProvider.notifier);

      // Add item from Vendor 1
      final res1 = notifier.addItem(
        vendorId: 'vendor-1',
        vendorName: "Sultan's Dine",
        vendorDeliveryRadiusKm: 5.0,
        vendorLat: 23.7925,
        vendorLng: 90.4078,
        product: sampleProduct1,
        quantity: 1,
        unitPrice: 420.0,
      );
      expect(res1, AddToCartResult.success);
      expect(container.read(cartProvider).vendorId, 'vendor-1');
      expect(container.read(cartProvider).items.length, 1);

      // Attempt to add item from Vendor 2 without forceReplace
      final res2 = notifier.addItem(
        vendorId: 'vendor-2',
        vendorName: 'Burger Point',
        vendorDeliveryRadiusKm: 4.0,
        vendorLat: 23.7780,
        vendorLng: 90.4180,
        product: sampleProduct2,
        quantity: 1,
        unitPrice: 280.0,
        forceReplace: false,
      );
      expect(res2, AddToCartResult.vendorConflict);
      expect(container.read(cartProvider).vendorId, 'vendor-1'); // Still vendor 1

      // Add item from Vendor 2 WITH forceReplace
      final res3 = notifier.addItem(
        vendorId: 'vendor-2',
        vendorName: 'Burger Point',
        vendorDeliveryRadiusKm: 4.0,
        vendorLat: 23.7780,
        vendorLng: 90.4180,
        product: sampleProduct2,
        quantity: 2,
        unitPrice: 280.0,
        forceReplace: true,
      );
      expect(res3, AddToCartResult.success);
      expect(container.read(cartProvider).vendorId, 'vendor-2');
      expect(container.read(cartProvider).items.length, 1);
      expect(container.read(cartProvider).totalItemCount, 2);
    });
  });

  group('Item Count Adjustments & Price Equations', () {
    test('Adjusting quantities recalculates item total, gross subtotal, and total payable', () {
      final container = ProviderContainer(
        overrides: [localStorageProvider.overrideWithValue(storage)],
      );
      final notifier = container.read(cartProvider.notifier);

      notifier.addItem(
        vendorId: 'vendor-1',
        vendorName: "Sultan's Dine",
        product: sampleProduct1,
        quantity: 1,
        unitPrice: 420.0,
      );

      var state = container.read(cartProvider);
      expect(state.grossSubtotal, 420.0);
      expect(state.deliveryFee, 60.0);
      expect(state.totalPayable, 480.0); // 420 + 60

      // Increment to 3
      notifier.updateQuantity(0, 3);
      state = container.read(cartProvider);
      expect(state.grossSubtotal, 1260.0); // 420 * 3
      expect(state.totalPayable, 1320.0); // 1260 + 60

      // Decrement to 0 removes item and clears cart
      notifier.updateQuantity(0, 0);
      state = container.read(cartProvider);
      expect(state.isEmpty, isTrue);
      expect(state.totalPayable, 0.0);
    });
  });

  group('Cart Address Geofence Guard', () {
    test('Address inside radius enables checkout; moving outside disables checkout and warns', () async {
      final container = ProviderContainer(
        overrides: [localStorageProvider.overrideWithValue(storage)],
      );
      final notifier = container.read(cartProvider.notifier);

      // Outlet in Banani [23.7925, 90.4078] with 5 km radius
      notifier.addItem(
        vendorId: 'vendor-banani',
        vendorName: "Sultan's Dine - Banani",
        vendorDeliveryRadiusKm: 5.0,
        vendorLat: 23.7925,
        vendorLng: 90.4078,
        product: sampleProduct1,
        quantity: 1,
        unitPrice: 420.0,
      );

      // 1. Customer at Banani Road 11 (distance ~0.0 km) -> Inside coverage
      await notifier.validateCoverage(customLat: 23.7925, customLng: 90.4078);
      var state = container.read(cartProvider);
      expect(state.isWithinCoverage, isTrue);
      expect(state.canCheckout, isTrue);
      expect(state.coverageError, isNull);

      // 2. Customer moves pin outside coverage (Gazipur / Narayanganj ~25 km away)
      await notifier.validateCoverage(customLat: 23.6000, customLng: 90.2000);
      state = container.read(cartProvider);
      expect(state.isWithinCoverage, isFalse);
      expect(state.canCheckout, isFalse); // CHECKOUT DISABLED!
      expect(state.coverageError, contains('outside'));

      // 3. Switch Delivery Method to Takeaway (Self-Pickup) -> Geofence waived, fee ৳0
      notifier.setDeliveryMethod(DeliveryMethod.takeaway);
      state = container.read(cartProvider);
      expect(state.isWithinCoverage, isTrue);
      expect(state.deliveryFee, 0.0);
      expect(state.canCheckout, isTrue); // CHECKOUT RE-ENABLED!
    });
  });

  group('Coupon Deduction', () {
    test('Applying coupon WELCOME50 deducts ৳50 from gross subtotal', () async {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(createTestMockDioClient()),
        ],
      );
      final notifier = container.read(cartProvider.notifier);

      notifier.addItem(
        vendorId: 'vendor-1',
        vendorName: "Sultan's Dine",
        product: sampleProduct1,
        quantity: 1,
        unitPrice: 420.0, // Subtotal 420 >= 250
      );

      final success = await notifier.applyCoupon('WELCOME50');
      expect(success, isTrue);

      final state = container.read(cartProvider);
      expect(state.couponCode, 'WELCOME50');
      expect(state.couponDiscount, 50.0);
      expect(state.discountedSubtotal, 370.0); // 420 - 50
      expect(state.totalPayable, 430.0); // 370 + 60 fee
    });
  });

  group('Checkout Coverage Await', () {
    test('checkout awaits the in-flight coverage verification instead of racing it', () async {
      final coverageGate = Completer<void>();
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            if (options.path.contains('/vendors/validate-address-coverage')) {
              await coverageGate.future;
              return handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'status': 'success',
                    'data': {'isActive': true, 'isBusy': false, 'estimatedDeliveryFee': 60.0},
                  },
                ),
              );
            }
            return handler.resolve(
              Response(requestOptions: options, statusCode: 200, data: {'status': 'success', 'data': {}}),
            );
          },
        ),
      );
      final client = DioClient(dio: dio);

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(client),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(cartProvider.notifier);
      notifier.addItem(
        vendorId: 'vendor-banani',
        vendorName: "Sultan's Dine - Banani",
        vendorDeliveryRadiusKm: 5.0,
        vendorLat: 23.7925,
        vendorLng: 90.4078,
        product: sampleProduct1,
        quantity: 1,
        unitPrice: 420.0,
      );

      var checkoutFinished = false;
      final checkoutFuture = notifier.checkout().then((result) {
        checkoutFinished = true;
        return result;
      });

      // While the coverage request is gated, checkout must still be pending
      // (it is awaiting the same in-flight verification, not polling a flag).
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(checkoutFinished, isFalse);

      coverageGate.complete();
      final result = await checkoutFuture;

      // Coverage resolved in-bounds, so checkout proceeded past the gate and
      // stopped at the (unauthenticated) login guard — not at the cart guard.
      expect(checkoutFinished, isTrue);
      expect(result['success'], isFalse);
      expect(result['message'], 'Please login to place your order.');
    });
  });

  group('CartScreen Widget UI', () {
    testWidgets('CartScreen displays item details, geofence status, bill summary, and place order CTA',
        (WidgetTester tester) async {
      final container = ProviderContainer(
        overrides: [localStorageProvider.overrideWithValue(storage)],
      );
      final notifier = container.read(cartProvider.notifier);

      notifier.addItem(
        vendorId: 'vendor-1',
        vendorName: "Sultan's Dine - Banani",
        vendorDeliveryRadiusKm: 5.0,
        vendorLat: 23.7925,
        vendorLng: 90.4078,
        product: sampleProduct1,
        quantity: 2,
        unitPrice: 420.0,
      );

      await tester.pumpWidget(createTestWidget(child: const CartScreen(), container: container));
      await tester.pumpAndSettle();

      expect(find.text('My Cart'), findsOneWidget);
      expect(find.text("Sultan's Dine - Banani"), findsOneWidget);
      expect(find.text('Kacchi Biryani'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('Home Delivery'), findsOneWidget);
      expect(find.text('Takeaway'), findsOneWidget);

      // Scroll down to reveal Bill Summary
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(find.text('Bill Summary'), findsOneWidget);
      expect(find.text('Item Subtotal'), findsOneWidget);
      expect(find.text('৳840'), findsWidgets); // 420 * 2 in item card and summary
      expect(find.text('Delivery Fee'), findsOneWidget);
      expect(find.text('৳60'), findsOneWidget);
      expect(find.text('Total Payable'), findsOneWidget);
      expect(find.text('৳900'), findsWidgets); // 840 + 60 in bill summary & bottom bar

      // Scroll back up to tap Takeaway mode
      await tester.drag(find.byType(ListView), const Offset(0, 300));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Takeaway'));
      await tester.pumpAndSettle();

      // Scroll down to verify updated bill
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(find.text('FREE'), findsOneWidget);
      expect(find.text('৳840'), findsWidgets); // 840 + 0
    });
  });
}
