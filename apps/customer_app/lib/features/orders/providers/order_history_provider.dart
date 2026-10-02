import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../cart/providers/cart_provider.dart';
import '../../store/domain/store_catalog_model.dart';
import '../domain/order_history_model.dart';

class OrderHistoryState {
  final List<PastOrder> orders;
  final bool isLoading;
  final String? error;

  OrderHistoryState({
    this.orders = const [],
    this.isLoading = false,
    this.error,
  });

  OrderHistoryState copyWith({
    List<PastOrder>? orders,
    bool? isLoading,
    String? error,
  }) {
    return OrderHistoryState(
      orders: orders ?? this.orders,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class OrderHistoryNotifier extends Notifier<OrderHistoryState> {
  @override
  OrderHistoryState build() {
    final auth = ref.watch(authProvider);
    if (auth.isAuthenticated) {
      Future.microtask(() => fetchHistory());
    }
    return OrderHistoryState(orders: const [], isLoading: false);
  }

  Future<void> fetchHistory() async {
    final auth = ref.read(authProvider);
    if (!auth.isAuthenticated) {
      state = OrderHistoryState(orders: const [], isLoading: false);
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(
        ApiConstants.orderHistory,
        queryParameters: {'page': 1, 'limit': 50},
      );
      if (response.statusCode == 200) {
        final data = response.data['data'];
        final items = data is Map<String, dynamic>
            ? (data['items'] as List<dynamic>? ?? [])
            : (data is List<dynamic> ? data : []);
        final parsed = items
            .whereType<Map<String, dynamic>>()
            .map((json) => PastOrder.fromJson(json))
            .toList();
        state = state.copyWith(
          orders: parsed,
          isLoading: false,
          error: null,
        );
        return;
      }
    } catch (e) {
      state = state.copyWith(
        orders: const [],
        isLoading: false,
        error: 'Failed to load order history',
      );
      return;
    }

    state = state.copyWith(orders: const [], isLoading: false);
  }

  Future<ReorderValidationResult> validateAndReorder(PastOrder pastOrder) async {
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.validateReorder,
        data: {'previousOrderId': pastOrder.id},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>? ?? {};
        final result = ReorderValidationResult.fromJson(data);

        if (result.isStoreOperational) {
          _populateCartWithAvailableItems(pastOrder, result);
        }
        return result;
      }
    } catch (_) {
      // Return failed validation result rather than faking success
    }

    return const ReorderValidationResult(
      isStoreOperational: false,
      hasStockChanges: true,
      validItems: [],
      unavailableItems: ['Could not validate re-order with server.'],
    );
  }

  void _populateCartWithAvailableItems(PastOrder pastOrder, ReorderValidationResult result) {
    final cartNotifier = ref.read(cartProvider.notifier);
    cartNotifier.clearCart();

    final unavailableSet = result.unavailableItems
        .map((u) => u.toLowerCase().trim())
        .toSet();

    for (final item in pastOrder.items) {
      final isUnavailable = unavailableSet.contains(item.name.toLowerCase().trim()) ||
          unavailableSet.contains(item.productId.toLowerCase().trim());
      if (isUnavailable) {
        continue;
      }

      final product = ProductModel(
        id: item.productId,
        name: item.name,
        basePrice: item.unitPrice,
        unitType: 'portion',
        isInStock: true,
      );

      VariantModel? selectedVariant;
      if (item.variantId != null && item.variantName != null) {
        selectedVariant = VariantModel(
          id: item.variantId!,
          name: item.variantName!,
          price: item.variantPrice ?? item.unitPrice,
          isInStock: true,
        );
      }

      final selectedAddons = item.addons
          .map((a) => AddonModel(
                id: a.id,
                name: a.name,
                price: a.price,
                isInStock: true,
              ))
          .toList();

      cartNotifier.addItem(
        vendorId: pastOrder.vendorId,
        vendorName: pastOrder.vendorName,
        product: product,
        selectedVariant: selectedVariant,
        selectedAddons: selectedAddons,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        forceReplace: true,
      );
    }
  }
}

final orderHistoryProvider =
    NotifierProvider<OrderHistoryNotifier, OrderHistoryState>(
  OrderHistoryNotifier.new,
);
