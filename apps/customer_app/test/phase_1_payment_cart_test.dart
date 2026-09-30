import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/auth/providers/auth_provider.dart';
import 'package:customer_app/features/cart/domain/cart_item_model.dart';
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

  group('Phase 1 - Online Payment & Cart Preservation Tests', () {
    test('Step 1.8: checkout returns chosen ONLINE_GATEWAY payment method after clearCart', () async {
      final mockDio = createTestMockDioClient();
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(mockDio),
        ],
      );

      // Authenticate user so checkout is permitted
      final loginSuccess = await container.read(authProvider.notifier).verifyOtp('+8801700000005', '123456');
      expect(loginSuccess, true);
      expect(container.read(authProvider).isAuthenticated, true);

      final notifier = container.read(cartProvider.notifier);

      // Add item to cart
      notifier.addItem(
        vendorId: 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
        vendorName: "Sultan's Dine",
        product: ProductModel(
          id: 'prod-1',
          name: 'Kacchi Biryani',
          basePrice: 450.0,
          unitType: 'portion',
          isInStock: true,
        ),
        quantity: 1,
        unitPrice: 450.0,
      );

      // Set online payment method
      notifier.setPaymentMethod(PaymentMethod.onlineCard);
      expect(container.read(cartProvider).paymentMethod, PaymentMethod.onlineCard);

      // Perform checkout
      final result = await notifier.checkout(
        deliveryAddressId: 'addr-1',
      );

      expect(result['success'], true);
      // Invariant: paymentMethod in result MUST be ONLINE_GATEWAY, preserved before clearCart() resets state
      expect(result['paymentMethod'], 'ONLINE_GATEWAY');
      // Invariant: cart items must be cleared
      expect(container.read(cartProvider).items.isEmpty, true);
    });

    test('Step 1.7: dioClientProvider carries Bearer token and polls payment status successfully', () async {
      final mockDio = createTestMockDioClient();
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(mockDio),
        ],
      );

      // Log in to set token in storage
      await container.read(authProvider.notifier).verifyOtp('+8801700000005', '123456');

      final dioClient = container.read(dioClientProvider);
      final response = await dioClient.get('/payments/status/SSLC-12345');

      expect(response.statusCode, 200);
      final data = response.data['data'] as Map<String, dynamic>;
      expect(data['status'], 'PAID');
    });
  });
}
