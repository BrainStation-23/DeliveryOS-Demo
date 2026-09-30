enum OrderStage {
  placed,
  riderAssigned,
  preparing,
  readyForPickup,
  dispatched,
  delivered,
  cancelled,
}

extension OrderStageExtension on OrderStage {
  static OrderStage fromString(String status) {
    switch (status.toUpperCase()) {
      case 'PLACED':
        return OrderStage.placed;
      case 'RIDER_ASSIGNED':
        return OrderStage.riderAssigned;
      case 'PREPARING':
      case 'ACCEPTED':
        return OrderStage.preparing;
      case 'READY_FOR_PICKUP':
        return OrderStage.readyForPickup;
      case 'DISPATCHED':
        return OrderStage.dispatched;
      case 'DELIVERED':
        return OrderStage.delivered;
      case 'CANCELLED':
        return OrderStage.cancelled;
      default:
        return OrderStage.placed;
    }
  }

  String get title {
    switch (this) {
      case OrderStage.placed:
        return 'Order Placed';
      case OrderStage.riderAssigned:
        return 'Courier Assigned';
      case OrderStage.preparing:
        return 'Kitchen Preparing';
      case OrderStage.readyForPickup:
        return 'Ready for Pickup';
      case OrderStage.dispatched:
        return 'Courier on the Way';
      case OrderStage.delivered:
        return 'Order Delivered';
      case OrderStage.cancelled:
        return 'Order Cancelled';
    }
  }

  String get description {
    switch (this) {
      case OrderStage.placed:
        return 'We received your order and are securing a courier';
      case OrderStage.riderAssigned:
        return 'Courier is traveling to the store';
      case OrderStage.preparing:
        return 'Chef is preparing your fresh meal';
      case OrderStage.readyForPickup:
        return 'Order packed and waiting for courier pickup';
      case OrderStage.dispatched:
        return 'Your courier is riding to your delivery address';
      case OrderStage.delivered:
        return 'Enjoy your meal! Thank you for choosing DeliveryOS';
      case OrderStage.cancelled:
        return 'This order has been cancelled';
    }
  }

  int get stepperIndex {
    switch (this) {
      case OrderStage.placed:
        return 0;
      case OrderStage.riderAssigned:
        return 1;
      case OrderStage.preparing:
        return 2;
      case OrderStage.readyForPickup:
        return 3;
      case OrderStage.dispatched:
        return 4;
      case OrderStage.delivered:
        return 5;
      case OrderStage.cancelled:
        return -1;
    }
  }
}

class StoreMeta {
  final String id;
  final String name;
  final String address;
  final String phone;
  final double latitude;
  final double longitude;

  StoreMeta({
    required this.id,
    required this.name,
    required this.address,
    required this.phone,
    required this.latitude,
    required this.longitude,
  });

  factory StoreMeta.initial() {
    return StoreMeta(
      id: '',
      name: 'Connecting to store...',
      address: '',
      phone: '',
      latitude: 0.0,
      longitude: 0.0,
    );
  }
}

class RiderMeta {
  final String id;
  final String name;
  final String phone;
  final String vehicleType;
  // Nullable by design: the platform has no courier-rating model yet, so the
  // UI must never render a fabricated score. Null hides the rating row.
  final double? rating;
  final double latitude;
  final double longitude;
  final double bearing;
  final double speed;

  RiderMeta({
    required this.id,
    required this.name,
    required this.phone,
    this.vehicleType = 'Motorcycle',
    this.rating,
    required this.latitude,
    required this.longitude,
    this.bearing = 45.0,
    this.speed = 28.0,
  });

  RiderMeta copyWith({
    double? latitude,
    double? longitude,
    double? bearing,
    double? speed,
  }) {
    return RiderMeta(
      id: id,
      name: name,
      phone: phone,
      vehicleType: vehicleType,
      rating: rating,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      bearing: bearing ?? this.bearing,
      speed: speed ?? this.speed,
    );
  }
}

class CustomerMeta {
  final String address;
  final String phone;
  final double latitude;
  final double longitude;

  CustomerMeta({
    required this.address,
    required this.phone,
    required this.latitude,
    required this.longitude,
  });

  factory CustomerMeta.defaultCustomer() {
    return CustomerMeta(
      address: 'House 14, Road 7, Banani, Dhaka',
      phone: '+8801700000005',
      latitude: 23.7940,
      longitude: 90.4030,
    );
  }
}

class OrderTrackingState {
  final String orderId;
  final String orderNumber;
  final OrderStage stage;
  final StoreMeta store;
  final RiderMeta? rider;
  final CustomerMeta customer;
  final int estimatedMinutesRemaining;
  final int itemsCount;
  final double totalAmount;
  final bool isLoading;
  final String? error;
  final String? cancellationReason;
  final String? paymentStatus;
  final String? paymentMethod;

  OrderTrackingState({
    required this.orderId,
    required this.orderNumber,
    required this.stage,
    required this.store,
    this.rider,
    required this.customer,
    this.estimatedMinutesRemaining = 18,
    this.itemsCount = 2,
    this.totalAmount = 480.0,
    this.isLoading = false,
    this.error,
    this.cancellationReason,
    this.paymentStatus,
    this.paymentMethod,
  });

  bool get isCompleted => stage == OrderStage.delivered;
  bool get isCancelled => stage == OrderStage.cancelled;
  bool get canCancel => stage == OrderStage.placed || stage == OrderStage.riderAssigned;
  bool isStageCompleted(OrderStage s) => stage.stepperIndex > s.stepperIndex;
  bool isStageActive(OrderStage s) => stage == s;

  OrderTrackingState copyWith({
    String? orderNumber,
    OrderStage? stage,
    StoreMeta? store,
    RiderMeta? rider,
    CustomerMeta? customer,
    int? estimatedMinutesRemaining,
    int? itemsCount,
    double? totalAmount,
    bool? isLoading,
    String? error,
    String? cancellationReason,
    String? paymentStatus,
    String? paymentMethod,
  }) {
    return OrderTrackingState(
      orderId: orderId,
      orderNumber: orderNumber ?? this.orderNumber,
      stage: stage ?? this.stage,
      store: store ?? this.store,
      rider: rider ?? this.rider,
      customer: customer ?? this.customer,
      estimatedMinutesRemaining: estimatedMinutesRemaining ?? this.estimatedMinutesRemaining,
      itemsCount: itemsCount ?? this.itemsCount,
      totalAmount: totalAmount ?? this.totalAmount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      cancellationReason: cancellationReason ?? this.cancellationReason,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paymentMethod: paymentMethod ?? this.paymentMethod,
    );
  }
}
