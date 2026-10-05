import '../../store/domain/store_catalog_model.dart';

enum DeliveryMethod {
  homeDelivery,
  takeaway,
}

extension DeliveryMethodExtension on DeliveryMethod {
  String get apiKey =>
      this == DeliveryMethod.homeDelivery ? 'HOME_DELIVERY' : 'TAKEAWAY';
  String get label => this == DeliveryMethod.homeDelivery
      ? 'Home Delivery'
      : 'Self-Pickup (Takeaway)';
}

enum PaymentMethod {
  cashOnDelivery,
  onlineCard,
}

extension PaymentMethodExtension on PaymentMethod {
  String get apiKey => this == PaymentMethod.cashOnDelivery
      ? 'CASH_ON_DELIVERY'
      : 'ONLINE_GATEWAY';
  String get label => this == PaymentMethod.cashOnDelivery
      ? 'Cash on Delivery (COD)'
      : 'Online Card / Mobile Wallet';
}

class CartItem {
  final ProductModel product;
  final VariantModel? selectedVariant;
  final int quantity;
  final String? specialInstructions;
  final double unitPrice;

  CartItem({
    required this.product,
    this.selectedVariant,
    required this.quantity,
    this.specialInstructions,
    required this.unitPrice,
  });

  double get totalPrice => unitPrice * quantity;

  CartItem copyWith({
    ProductModel? product,
    VariantModel? selectedVariant,
    int? quantity,
    String? specialInstructions,
    double? unitPrice,
  }) {
    return CartItem(
      product: product ?? this.product,
      selectedVariant: selectedVariant ?? this.selectedVariant,
      quantity: quantity ?? this.quantity,
      specialInstructions: specialInstructions ?? this.specialInstructions,
      unitPrice: unitPrice ?? this.unitPrice,
    );
  }

  Map<String, dynamic> toCheckoutJson() {
    return {
      'productId': product.id,
      'quantity': quantity,
      if (selectedVariant != null) 'variantId': selectedVariant!.id,
    };
  }
}

class CartState {
  final String? vendorId;
  final String? vendorName;
  final double vendorDeliveryRadiusKm;
  final double? vendorLat;
  final double? vendorLng;
  final List<CartItem> items;
  final DeliveryMethod deliveryMethod;
  final PaymentMethod paymentMethod;
  final String? couponCode;
  final double couponDiscount;
  final bool isWithinCoverage;
  final String? coverageError;
  final bool isCheckingCoverage;
  final bool isApplyingCoupon;
  final String? couponMessage;
  final bool isVendorActive;
  final bool isVendorBusy;
  final double? estimatedDeliveryFee;
  final double? couponMinSpend;

  CartState({
    this.vendorId,
    this.vendorName,
    this.vendorDeliveryRadiusKm = 5.0,
    this.vendorLat,
    this.vendorLng,
    this.items = const [],
    this.deliveryMethod = DeliveryMethod.homeDelivery,
    this.paymentMethod = PaymentMethod.cashOnDelivery,
    this.couponCode,
    this.couponDiscount = 0.0,
    this.isWithinCoverage = true,
    this.coverageError,
    this.isCheckingCoverage = false,
    this.isApplyingCoupon = false,
    this.couponMessage,
    this.isVendorActive = true,
    this.isVendorBusy = false,
    this.estimatedDeliveryFee,
    this.couponMinSpend,
  });

  bool get isEmpty => items.isEmpty;
  int get totalItemCount =>
      items.fold<int>(0, (sum, item) => sum + item.quantity);

  double get grossSubtotal =>
      items.fold<double>(0.0, (sum, item) => sum + item.totalPrice);

  double get deliveryFee =>
      (deliveryMethod == DeliveryMethod.takeaway || isEmpty)
          ? 0.0
          : (estimatedDeliveryFee ?? 60.0);

  double get discountedSubtotal {
    final sub = grossSubtotal - couponDiscount;
    return sub < 0 ? 0.0 : sub;
  }

  double get totalPayable => isEmpty ? 0.0 : (discountedSubtotal + deliveryFee);

  bool get canCheckout {
    if (isEmpty) return false;
    if (!isVendorActive || isVendorBusy) return false;
    if (deliveryMethod == DeliveryMethod.homeDelivery && !isWithinCoverage) {
      return false;
    }
    return true;
  }

  CartState copyWith({
    String? vendorId,
    String? vendorName,
    double? vendorDeliveryRadiusKm,
    double? vendorLat,
    double? vendorLng,
    List<CartItem>? items,
    DeliveryMethod? deliveryMethod,
    PaymentMethod? paymentMethod,
    String? couponCode,
    bool clearCoupon = false,
    double? couponDiscount,
    bool? isWithinCoverage,
    String? coverageError,
    bool clearCoverageError = false,
    bool? isCheckingCoverage,
    bool? isApplyingCoupon,
    String? couponMessage,
    bool clearCouponMessage = false,
    bool? isVendorActive,
    bool? isVendorBusy,
    double? estimatedDeliveryFee,
    double? couponMinSpend,
  }) {
    return CartState(
      vendorId: vendorId ?? this.vendorId,
      vendorName: vendorName ?? this.vendorName,
      vendorDeliveryRadiusKm:
          vendorDeliveryRadiusKm ?? this.vendorDeliveryRadiusKm,
      vendorLat: vendorLat ?? this.vendorLat,
      vendorLng: vendorLng ?? this.vendorLng,
      items: items ?? this.items,
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      couponCode: clearCoupon ? null : (couponCode ?? this.couponCode),
      couponDiscount:
          clearCoupon ? 0.0 : (couponDiscount ?? this.couponDiscount),
      isWithinCoverage: isWithinCoverage ?? this.isWithinCoverage,
      coverageError:
          clearCoverageError ? null : (coverageError ?? this.coverageError),
      isCheckingCoverage: isCheckingCoverage ?? this.isCheckingCoverage,
      isApplyingCoupon: isApplyingCoupon ?? this.isApplyingCoupon,
      couponMessage:
          clearCouponMessage ? null : (couponMessage ?? this.couponMessage),
      isVendorActive: isVendorActive ?? this.isVendorActive,
      isVendorBusy: isVendorBusy ?? this.isVendorBusy,
      estimatedDeliveryFee: estimatedDeliveryFee ?? this.estimatedDeliveryFee,
      couponMinSpend: clearCoupon ? null : (couponMinSpend ?? this.couponMinSpend),
    );
  }
}
