import '../../../core/constants/map_defaults.dart';

class RiderCompletedTrip {
  final String orderId;
  final String orderNumber;
  final String storeName;
  final String customerAddress;
  final DateTime completedAt;
  final double payout;
  final double codCollected;
  final bool isCod;
  final double distanceKm;

  const RiderCompletedTrip({
    required this.orderId,
    required this.orderNumber,
    required this.storeName,
    required this.customerAddress,
    required this.completedAt,
    required this.payout,
    this.codCollected = 0.0,
    required this.isCod,
    this.distanceKm = 2.4,
  });
}

class RiderDutyState {
  final bool isOnline;
  final bool isBeaconing;
  final double latitude;
  final double longitude;
  final double speed;
  final double bearing;
  final int todayTrips;
  final double todayEarnings;
  final int weeklyTrips;
  final double weeklyEarnings;
  final double codCashInHand;
  final double cashSafetyLimit;
  final String? activeOrderId;
  final DateTime? lastBeaconTimestamp;
  final String statusMessage;
  final bool isToggling;
  final bool isDepositingCash;
  final List<RiderCompletedTrip> completedTrips;
  final String? error;

  RiderDutyState({
    this.isOnline = false,
    this.isBeaconing = false,
    this.latitude = MapDefaults.centerLatitude,
    this.longitude = MapDefaults.centerLongitude,
    this.speed = 0.0,
    this.bearing = 0.0,
    this.todayTrips = 0,
    this.todayEarnings = 0.0,
    this.weeklyTrips = 0,
    this.weeklyEarnings = 0.0,
    this.codCashInHand = 0.0,
    this.cashSafetyLimit = 5000.0,
    this.activeOrderId,
    this.lastBeaconTimestamp,
    this.statusMessage = 'Offline • Tap switch to go Online',
    this.isToggling = false,
    this.isDepositingCash = false,
    this.completedTrips = const [],
    this.error,
  });

  bool get canAcceptCodTrips => codCashInHand < cashSafetyLimit;
  bool get isCashLimitReached => codCashInHand >= cashSafetyLimit;
  double get remainingCashLimit => (cashSafetyLimit - codCashInHand).clamp(0.0, double.infinity);
  double get cashLimitUsageRatio => cashSafetyLimit > 0 ? (codCashInHand / cashSafetyLimit).clamp(0.0, 1.0) : 0.0;
  bool get isNearCashLimit => cashLimitUsageRatio >= 0.8 && !isCashLimitReached;

  RiderDutyState copyWith({
    bool? isOnline,
    bool? isBeaconing,
    double? latitude,
    double? longitude,
    double? speed,
    double? bearing,
    int? todayTrips,
    double? todayEarnings,
    int? weeklyTrips,
    double? weeklyEarnings,
    double? codCashInHand,
    double? cashSafetyLimit,
    String? activeOrderId,
    DateTime? lastBeaconTimestamp,
    String? statusMessage,
    bool? isToggling,
    bool? isDepositingCash,
    List<RiderCompletedTrip>? completedTrips,
    String? error,
    bool clearError = false,
  }) {
    return RiderDutyState(
      isOnline: isOnline ?? this.isOnline,
      isBeaconing: isBeaconing ?? this.isBeaconing,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speed: speed ?? this.speed,
      bearing: bearing ?? this.bearing,
      todayTrips: todayTrips ?? this.todayTrips,
      todayEarnings: todayEarnings ?? this.todayEarnings,
      weeklyTrips: weeklyTrips ?? this.weeklyTrips,
      weeklyEarnings: weeklyEarnings ?? this.weeklyEarnings,
      codCashInHand: codCashInHand ?? this.codCashInHand,
      cashSafetyLimit: cashSafetyLimit ?? this.cashSafetyLimit,
      activeOrderId: activeOrderId ?? this.activeOrderId,
      lastBeaconTimestamp: lastBeaconTimestamp ?? this.lastBeaconTimestamp,
      statusMessage: statusMessage ?? this.statusMessage,
      isToggling: isToggling ?? this.isToggling,
      isDepositingCash: isDepositingCash ?? this.isDepositingCash,
      completedTrips: completedTrips ?? this.completedTrips,
      error: clearError ? null : (error ?? this.error),
    );
  }
}
