import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/network/dio_client.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/auth/providers/auth_provider.dart';
import 'package:customer_app/features/cart/providers/cart_provider.dart';
import 'package:customer_app/features/orders/domain/order_history_model.dart';
import 'package:customer_app/features/orders/providers/order_history_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  DioClient createReorderMockDio({
    required bool isStoreOperational,
    required List<Map<String, dynamic>> validItems,
    required List<dynamic> unavailableItems,
  }) {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.contains('/orders/validate-reorder')) {
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'status': 'success',
                  'data': {
                    'isStoreOperational': isStoreOperational,
                    'hasStockChanges': unavailableItems.isNotEmpty,
                    'validItems': validItems,
                    'unavailableItems': unavailableItems,
                  },
                },
              ),
            );
          }
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'status': 'success', 'data': {}},
            ),
          );
        },
      ),
    );
    return DioClient(dio: dio);
  }

  final samplePastOrder = PastOrder(
    id: 'past-ord-101',
    orderNumber: 'ORD-101',
    vendorId: 'vendor-01',
    vendorName: "Sultan's Dine - Banani",
    createdAt: DateTime(2026, 9, 20, 14, 30),
    totalAmount: 760.0,
    status: 'DELIVERED',
    items: [
      OrderItemSummary(
        productId: 'prod-kacchi',
        name: 'Kacchi Biryani',
        quantity: 1,
        unitPrice: 380.0, // Historical price from 1 month ago
      ),
      OrderItemSummary(
        productId: 'prod-tehari',
        name: 'Beef Tehari',
        quantity: 1,
        unitPrice: 300.0,
      ),
    ],
  );

  group('T14: Customer Reorder Freshness & Catalog Sync', () {
    test('Reorder populates cart with current catalog prices rather than historical order prices', () async {
      final mockDio = createReorderMockDio(
        isStoreOperational: true,
        validItems: [
          {
            'productId': 'prod-kacchi',
            'name': 'Kacchi Biryani (Premium Basmati)',
            'currentBasePrice': 450.0, // Updated price in server catalog
            'quantity': 1,
            'variantId': null,
            'isAvailable': true,
          },
          {
            'productId': 'prod-tehari',
            'name': 'Beef Tehari',
            'currentBasePrice': 320.0, // Updated price in server catalog
            'quantity': 1,
            'variantId': null,
            'isAvailable': true,
          },
        ],
        unavailableItems: [],
      );

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(mockDio),
        ],
      );


      final notifier = container.read(orderHistoryProvider.notifier);
      final result = await notifier.validateAndReorder(samplePastOrder);

      expect(result.isStoreOperational, isTrue);
      expect(result.hasStockChanges, isFalse);

      final cart = container.read(cartProvider);
      expect(cart.items.length, 2);

      // Verify item 1 price updated from historical 380 to current 450
      final kacchiItem = cart.items.firstWhere((i) => i.product.id == 'prod-kacchi');
      expect(kacchiItem.unitPrice, 450.0);
      expect(kacchiItem.product.name, 'Kacchi Biryani (Premium Basmati)');

      // Verify item 2 price updated from historical 300 to current 320
      final tehariItem = cart.items.firstWhere((i) => i.product.id == 'prod-tehari');
      expect(tehariItem.unitPrice, 320.0);

      // Verify cart subtotal reflects current prices (450 + 320 = 770, not historical 680)
      expect(cart.grossSubtotal, 770.0);
    });

    test('Reorder filters out items flagged as unavailable by the server', () async {
      final mockDio = createReorderMockDio(
        isStoreOperational: true,
        validItems: [
          {
            'productId': 'prod-kacchi',
            'name': 'Kacchi Biryani',
            'currentBasePrice': 450.0,
            'quantity': 1,
            'variantId': null,
            'isAvailable': true,
          },
        ],
        unavailableItems: ['Beef Tehari'],
      );

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(mockDio),
        ],
      );


      final notifier = container.read(orderHistoryProvider.notifier);
      final result = await notifier.validateAndReorder(samplePastOrder);

      expect(result.isStoreOperational, isTrue);
      expect(result.hasStockChanges, isTrue);
      expect(result.unavailableItems, contains('Beef Tehari'));

      final cart = container.read(cartProvider);
      expect(cart.items.length, 1);
      expect(cart.items.first.product.id, 'prod-kacchi');
      expect(cart.grossSubtotal, 450.0);
    });

    test('Reorder does not populate cart when vendor store is not operational', () async {
      final mockDio = createReorderMockDio(
        isStoreOperational: false,
        validItems: [],
        unavailableItems: ['Store is currently closed'],
      );

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(mockDio),
        ],
      );


      final notifier = container.read(orderHistoryProvider.notifier);
      final result = await notifier.validateAndReorder(samplePastOrder);

      expect(result.isStoreOperational, isFalse);

      final cart = container.read(cartProvider);
      expect(cart.isEmpty, isTrue);
    });
  });
}
