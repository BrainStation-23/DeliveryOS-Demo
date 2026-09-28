import '../../../core/constants/map_defaults.dart';

enum TripStep {
  accept, // Step 0: Broadcast alert
  pickup, // Step 1: Claimed, navigating to store to pick up food
  delivering, // Step 2: Picked up, navigating to customer doorstep
  handover, // Step 3: At doorstep, verifying payment & completing handover
  completed, // Done
}

extension TripStepExtension on TripStep {
  int get stepNumber {
    switch (this) {
      case TripStep.accept:
        return 0;
      case TripStep.pickup:
        return 1;
      case TripStep.delivering:
        return 2;
      case TripStep.handover:
      case TripStep.completed:
        return 3;
    }
  }

  String get stepTitle {
    switch (this) {
      case TripStep.accept:
        return 'Trip Broadcast';
      case TripStep.pickup:
        return 'Step 1: Pick Up Food';
      case TripStep.delivering:
        return 'Step 2: Deliver to Customer';
      case TripStep.handover:
      case TripStep.completed:
        return 'Step 3: Complete Handover';
    }
  }
}

class TripStoreMeta {
  final String id;
  final String name;
  final String address;
  final String phone;
  final double latitude;
  final double longitude;
  final String? instructions;

  TripStoreMeta({
    required this.id,
    required this.name,
    required this.address,
    required this.phone,
    required this.latitude,
    required this.longitude,
    this.instructions,
  });

  factory TripStoreMeta.defaultSultansDine() {
    return TripStoreMeta(
      id: 'store-sultans-dine-01',
      name: "Sultan's Dine - Banani",
      address: 'House 42, Road 11, Block D, Banani, Dhaka',
      phone: '+8801711223344',
      latitude: MapDefaults.centerLatitude,
      longitude: MapDefaults.centerLongitude,
      instructions: 'Enter via side gate; collect from designated DeliveryOS counter.',
    );
  }
}

class TripCustomerMeta {
  final String name;
  final String address;
  final String phone;
  final double latitude;
  final double longitude;
  final String? deliveryNotes;

  TripCustomerMeta({
    required this.name,
    required this.address,
    required this.phone,
    required this.latitude,
    required this.longitude,
    this.deliveryNotes,
  });

  factory TripCustomerMeta.defaultCustomer() {
    return TripCustomerMeta(
      name: 'Tanvir Ahmed',
      address: 'House 14, Road 7, Block F, Banani, Dhaka',
      phone: '',
      latitude: MapDefaults.centerLatitude,
      longitude: MapDefaults.centerLongitude,
      deliveryNotes: 'Lift to 4th floor, Flat 4B. Ring doorbell twice.',
    );
  }
}

class TripOrder {
  final String id;
  final String orderNumber;
  final String status;
  final TripStoreMeta store;
  final TripCustomerMeta customer;
  final int itemsCount;
  final String itemsSummary;
  final bool isCod;
  final double totalAmount;
  final double payout;
  final double distanceKm;
  final TripStep currentStep;

  TripOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.store,
    required this.customer,
    this.itemsCount = 2,
    this.itemsSummary = '2x Kacchi Biryani, 1x Borhani',
    this.isCod = true,
    this.totalAmount = 480.0,
    this.payout = 60.0,
    this.distanceKm = 2.4,
    this.currentStep = TripStep.pickup,
  });

  TripOrder copyWith({
    String? status,
    TripStep? currentStep,
    double? payout,
    bool? isCod,
    double? totalAmount,
    TripStoreMeta? store,
    TripCustomerMeta? customer,
  }) {
    return TripOrder(
      id: id,
      orderNumber: orderNumber,
      status: status ?? this.status,
      itemsCount: itemsCount,
      itemsSummary: itemsSummary,
      isCod: isCod ?? this.isCod,
      totalAmount: totalAmount ?? this.totalAmount,
      payout: payout ?? this.payout,
      distanceKm: distanceKm,
      currentStep: currentStep ?? this.currentStep,
      store: store ?? this.store,
      customer: customer ?? this.customer,
    );
  }

  factory TripOrder.fromJson(Map<String, dynamic> json) {
    final storeRaw = json['vendor'] as Map<String, dynamic>? ?? {};
    final addressRaw = json['deliveryAddressSnapshot'] as Map<String, dynamic>? ?? {};

    return TripOrder(
      id: json['id'] as String? ?? 'ord-mock-01',
      orderNumber: json['orderNumber'] as String? ?? '#ORD-2026',
      status: json['status'] as String? ?? 'RIDER_ASSIGNED',
      store: TripStoreMeta(
        id: storeRaw['id'] as String? ?? 'store-01',
        name: storeRaw['name'] as String? ?? "Sultan's Dine",
        address: storeRaw['address'] as String? ?? 'Banani, Dhaka',
        phone: storeRaw['phone'] as String? ?? '',
        latitude: (storeRaw['latitude'] as num?)?.toDouble() ?? MapDefaults.centerLatitude,
        longitude: (storeRaw['longitude'] as num?)?.toDouble() ?? MapDefaults.centerLongitude,
      ),
      customer: TripCustomerMeta(
        name: json['customerName'] as String? ?? 'Customer',
        address: addressRaw['addressLine'] as String? ?? 'Banani, Dhaka',
        phone: json['customerPhone'] as String? ?? '',
        latitude: (addressRaw['latitude'] as num?)?.toDouble() ?? MapDefaults.centerLatitude,
        longitude: (addressRaw['longitude'] as num?)?.toDouble() ?? MapDefaults.centerLongitude,
        deliveryNotes: json['customerNotes'] as String?,
      ),
      itemsCount: (json['itemsCount'] as num?)?.toInt() ?? 2,
      itemsSummary: json['itemsSummary'] as String? ?? 'Fresh Meal Package',
      isCod: json['paymentMethod'] == 'CASH_ON_DELIVERY' || json['isCod'] == true,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 480.0,
      payout: (json['deliveryFee'] as num?)?.toDouble() ?? 60.0,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 2.4,
      currentStep: TripStep.pickup,
    );
  }

  factory TripOrder.pilotKacchiOrder({
    String? id,
    String? orderNumber,
    bool isCod = true,
    double totalAmount = 480.0,
    double payout = 60.0,
  }) {
    return TripOrder(
      id: id ?? 'ord-pilot-kacchi-101',
      orderNumber: orderNumber ?? '#ORD-2026-101',
      status: 'RIDER_ASSIGNED',
      store: TripStoreMeta.defaultSultansDine(),
      customer: TripCustomerMeta.defaultCustomer(),
      itemsCount: 2,
      itemsSummary: '1x Kacchi Biryani (Basmati Full), 1x Chilled Borhani',
      isCod: isCod,
      totalAmount: totalAmount,
      payout: payout,
      distanceKm: 2.1,
      currentStep: TripStep.pickup,
    );
  }
}
