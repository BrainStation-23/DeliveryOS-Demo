import '../../../../core/utils/numeric_parser.dart';

class AddonSnapshotItem {
  final String id;
  final String name;
  final double price;

  const AddonSnapshotItem({
    required this.id,
    required this.name,
    required this.price,
  });

  factory AddonSnapshotItem.fromJson(Map<String, dynamic> json) {
    return AddonSnapshotItem(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      price: parseDouble(json['price']),
    );
  }
}

class OrderItemSummary {
  final String productId;
  final String name;
  final int quantity;
  final double unitPrice;
  final String? variantId;
  final String? variantName;
  final double? variantPriceModifier;
  final List<AddonSnapshotItem> addons;

  OrderItemSummary({
    required this.productId,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    this.variantId,
    this.variantName,
    this.variantPriceModifier,
    this.addons = const [],
  });

  double get totalPrice => unitPrice * quantity;

  factory OrderItemSummary.fromJson(Map<String, dynamic> json) {
    final variantSnap = json['variantSnapshot'] is Map<String, dynamic>
        ? json['variantSnapshot'] as Map<String, dynamic>
        : null;
    final variantId = variantSnap?['id']?.toString() ?? json['variantId']?.toString();
    final variantName = variantSnap?['name']?.toString() ??
        json['variantName']?.toString() ??
        json['variant_name']?.toString();
    final variantPriceModifier = variantSnap != null ? parseDouble(variantSnap['priceModifier']) : null;

    final addonsRaw = json['addonsSnapshot'] as List<dynamic>? ??
        json['addons'] as List<dynamic>? ??
        [];
    final addons = addonsRaw
        .whereType<Map<String, dynamic>>()
        .map((a) => AddonSnapshotItem.fromJson(a))
        .toList();

    return OrderItemSummary(
      productId: json['productId'] as String? ?? json['product_id'] as String? ?? '',
      name: json['productNameSnapshot'] as String? ??
          json['productName'] as String? ??
          json['name'] as String? ??
          'Menu Item',
      quantity: parseInt(json['quantity'], 1),
      unitPrice: parseDouble(json['unitPrice'] ?? json['unit_price']),
      variantId: variantId,
      variantName: variantName,
      variantPriceModifier: variantPriceModifier,
      addons: addons,
    );
  }
}

class PastOrder {
  final String id;
  final String orderNumber;
  final String vendorId;
  final String vendorName;
  final String status;
  final double totalAmount;
  final DateTime createdAt;
  final List<OrderItemSummary> items;

  PastOrder({
    required this.id,
    required this.orderNumber,
    required this.vendorId,
    required this.vendorName,
    required this.status,
    required this.totalAmount,
    required this.createdAt,
    required this.items,
  });

  bool get isActive => ['PLACED', 'RIDER_ASSIGNED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED'].contains(status.toUpperCase());

  factory PastOrder.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['orderItems'] as List<dynamic>? ?? json['items'] as List<dynamic>? ?? [];
    final vendor = json['vendor'] as Map<String, dynamic>? ?? {};
    final rawDate = json['placedAt'] ?? json['createdAt'];

    return PastOrder(
      id: json['id'] as String? ?? '',
      orderNumber: json['orderNumber'] as String? ?? json['order_number'] as String? ?? '#ORD-2026',
      vendorId: json['vendorId'] as String? ?? json['vendor_id'] as String? ?? vendor['id'] as String? ?? '',
      vendorName: vendor['name'] as String? ?? json['vendorName'] as String? ?? 'Outlet',
      status: json['status'] as String? ?? 'DELIVERED',
      totalAmount: parseDouble(json['totalAmount'] ?? json['total_amount']),
      createdAt: rawDate != null
          ? DateTime.tryParse(rawDate.toString()) ?? DateTime.now()
          : DateTime.now(),
      items: itemsRaw.map((i) => OrderItemSummary.fromJson(i as Map<String, dynamic>)).toList(),
    );
  }
}

class ReorderValidationResult {
  final bool isStoreOperational;
  final bool hasStockChanges;
  final List<dynamic> validItems;
  final List<String> unavailableItems;

  const ReorderValidationResult({
    required this.isStoreOperational,
    required this.hasStockChanges,
    this.validItems = const [],
    this.unavailableItems = const [],
  });

  factory ReorderValidationResult.fromJson(Map<String, dynamic> json) {
    return ReorderValidationResult(
      isStoreOperational: json['isStoreOperational'] as bool? ?? true,
      hasStockChanges: json['hasStockChanges'] as bool? ?? false,
      validItems: json['validItems'] as List<dynamic>? ?? [],
      unavailableItems: (json['unavailableItems'] as List<dynamic>?)?.map((e) {
        if (e is Map<String, dynamic>) {
          return e['productNameSnapshot']?.toString() ??
              e['name']?.toString() ??
              e['productId']?.toString() ??
              e.toString();
        }
        return e.toString();
      }).toList() ?? [],
    );
  }
}
