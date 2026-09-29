import 'dart:async';
import '../../../core/constants/map_defaults.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/socket_service.dart';
import '../../dashboard/domain/duty_models.dart';
import '../../dashboard/providers/duty_provider.dart';
import '../domain/trip_models.dart';

class RiderTripState {
  final TripOrder? incomingTrip;
  final TripOrder? activeTrip;
  final int countdownSeconds;
  final bool isClaiming;
  final bool isUpdating;
  final String? error;

  RiderTripState({
    this.incomingTrip,
    this.activeTrip,
    this.countdownSeconds = 45,
    this.isClaiming = false,
    this.isUpdating = false,
    this.error,
  });

  bool get hasIncomingAlert => incomingTrip != null;
  bool get hasActiveTrip => activeTrip != null;

  RiderTripState copyWith({
    TripOrder? incomingTrip,
    bool clearIncomingTrip = false,
    TripOrder? activeTrip,
    bool clearActiveTrip = false,
    int? countdownSeconds,
    bool? isClaiming,
    bool? isUpdating,
    String? error,
    bool clearError = false,
  }) {
    return RiderTripState(
      incomingTrip: clearIncomingTrip ? null : (incomingTrip ?? this.incomingTrip),
      activeTrip: clearActiveTrip ? null : (activeTrip ?? this.activeTrip),
      countdownSeconds: countdownSeconds ?? this.countdownSeconds,
      isClaiming: isClaiming ?? this.isClaiming,
      isUpdating: isUpdating ?? this.isUpdating,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class RiderTripNotifier extends Notifier<RiderTripState> {
  Timer? _countdownTimer;

  @override
  RiderTripState build() {
    final socket = ref.watch(riderSocketServiceProvider);

    void handleBroadcast(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        // Contact details and precise coordinates are unknown at broadcast
        // time — they are hydrated from the claim response. Empty phones keep
        // the call buttons disabled instead of dialing a fake number.
        final store = TripStoreMeta(
          id: data['vendorId']?.toString() ?? 'store-01',
          name: data['vendorName']?.toString() ?? 'Restaurant',
          address: data['vendorAddress']?.toString() ?? 'Dhaka',
          phone: '',
          latitude: MapDefaults.centerLatitude,
          longitude: MapDefaults.centerLongitude,
        );
        final customer = TripCustomerMeta(
          name: 'Customer',
          address: data['deliveryArea']?.toString() ?? 'Delivery Address',
          phone: '',
          latitude: MapDefaults.centerLatitude,
          longitude: MapDefaults.centerLongitude,
        );
        final isCod = data['isCod'] == true ||
            (data['paymentMethod'] != null && data['paymentMethod'].toString() == 'CASH_ON_DELIVERY') ||
            (data['paymentMethod'] == null && data['isCod'] == null);
        final double distanceKm = (data['distanceKm'] as num?)?.toDouble() ?? 0.0;
        final double riderEarnings = (data['riderEarnings'] as num?)?.toDouble() ?? 0.0;
        final double totalAmount = (data['totalAmount'] as num?)?.toDouble() ?? 0.0;
        final trip = TripOrder(
          id: data['orderId']?.toString() ?? '',
          orderNumber: data['orderNumber']?.toString() ?? 'ORD',
          status: 'PLACED',
          store: store,
          customer: customer,
          distanceKm: distanceKm,
          payout: riderEarnings,
          isCod: isCod,
          totalAmount: totalAmount,
          itemsCount: (data['itemCount'] as num?)?.toInt() ?? 1,
        );
        triggerBroadcastAlert(trip);
      }
    }

    void handleOrderCancelled(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        final orderId = data['orderId']?.toString();
        final reason = data['reason']?.toString() ?? 'Order was cancelled.';

        if (state.incomingTrip?.id == orderId) {
          dismissIncomingAlert();
        }
        if (state.activeTrip?.id == orderId) {
          final orderNum = state.activeTrip?.orderNumber;
          socket.leaveOrder(orderId!);
          state = state.copyWith(
            clearActiveTrip: true,
            error: 'Order $orderNum was cancelled ($reason)',
          );
        }
      }
    }

    socket.on('dispatch:broadcast', handleBroadcast);
    socket.on('order:cancelled', handleOrderCancelled);

    ref.onDispose(() {
      socket.off('dispatch:broadcast');
      socket.off('order:cancelled');
      _countdownTimer?.cancel();
    });
    return RiderTripState();
  }

  void stopTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
  }

  void triggerBroadcastAlert(TripOrder trip) {
    _countdownTimer?.cancel();
    state = state.copyWith(
      incomingTrip: trip,
      countdownSeconds: 45,
      clearError: true,
    );

    // Initial alert chime & haptic pulse
    try {
      SystemSound.play(SystemSoundType.alert);
      HapticFeedback.heavyImpact();
    } catch (_) {}

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.countdownSeconds <= 1) {
        dismissIncomingAlert();
      } else {
        // Continuous alert pulse every 3 seconds while alert is pending
        if (state.countdownSeconds % 3 == 0) {
          try {
            SystemSound.play(SystemSoundType.alert);
            HapticFeedback.heavyImpact();
          } catch (_) {}
        }
        state = state.copyWith(countdownSeconds: state.countdownSeconds - 1);
      }
    });
  }

  void dismissIncomingAlert() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    state = state.copyWith(clearIncomingTrip: true, countdownSeconds: 45);
  }

  Future<bool> claimTrip(TripOrder trip) async {
    final dutyState = ref.read(riderDutyProvider);

    // INVARIANT GUARD: Block accepting new COD trips if cash_in_hand >= max_cash_limit
    if (trip.isCod && dutyState.isCashLimitReached) {
      state = state.copyWith(
        error: 'COD Safety Limit Reached (৳${dutyState.cashSafetyLimit.toStringAsFixed(0)}). Deposit cash at the central hub before accepting COD trips.',
      );
      return false;
    }

    _countdownTimer?.cancel();
    _countdownTimer = null;

    state = state.copyWith(isClaiming: true, clearError: true);

    Map<String, dynamic> claimedPayload = {};
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post('${ApiConstants.claimOrder}/${trip.id}/claim');
      if (response.statusCode != 200 && response.statusCode != 201) {
        state = state.copyWith(
          isClaiming: false,
          error: 'Failed to claim order. It may have been claimed by another courier.',
        );
        return false;
      }
      claimedPayload = response.data['data'] as Map<String, dynamic>? ?? {};
    } catch (e) {
      state = state.copyWith(
        isClaiming: false,
        error: 'Network error claiming order. Please check connection and try again.',
      );
      return false;
    }

    // Hydrate real contact + coordinate data from the claimed order
    final vendor = claimedPayload['vendor'] as Map<String, dynamic>? ?? {};
    final addressSnapshot = claimedPayload['deliveryAddressSnapshot'] as Map<String, dynamic>? ?? {};
    final hydratedStore = TripStoreMeta(
      id: trip.store.id,
      name: vendor['name']?.toString() ?? trip.store.name,
      address: vendor['addressText']?.toString() ?? trip.store.address,
      phone: vendor['contactPhone']?.toString() ?? trip.store.phone,
      latitude: (vendor['latitude'] as num?)?.toDouble() ?? trip.store.latitude,
      longitude: (vendor['longitude'] as num?)?.toDouble() ?? trip.store.longitude,
    );
    final hydratedCustomer = TripCustomerMeta(
      name: trip.customer.name,
      address: addressSnapshot['addressLine']?.toString() ?? trip.customer.address,
      phone: claimedPayload['customerPhoneSnapshot']?.toString() ?? trip.customer.phone,
      latitude: (addressSnapshot['latitude'] as num?)?.toDouble() ?? trip.customer.latitude,
      longitude: (addressSnapshot['longitude'] as num?)?.toDouble() ?? trip.customer.longitude,
    );
    final claimedPaymentMethod = claimedPayload['paymentMethod']?.toString();
    final bool isCodClaimed = claimedPaymentMethod != null
        ? claimedPaymentMethod == 'CASH_ON_DELIVERY'
        : trip.isCod;
    final double totalAmount = (claimedPayload['totalAmount'] as num?)?.toDouble() ?? trip.totalAmount;
    // Earnings must come from the server's rider share computation
    // (riderEarnings), never from the gross deliveryFee.
    final double payout = (claimedPayload['riderEarnings'] as num?)?.toDouble() ?? trip.payout;

    final claimedTrip = trip.copyWith(
      currentStep: TripStep.pickup,
      status: 'RIDER_ASSIGNED',
      isCod: isCodClaimed,
      totalAmount: totalAmount,
      payout: payout,
      store: hydratedStore,
      customer: hydratedCustomer,
    );

    // Join order room for real-time lifecycle and cancellation events
    ref.read(riderSocketServiceProvider).joinOrder(trip.id);

    state = state.copyWith(
      isClaiming: false,
      clearIncomingTrip: true,
      activeTrip: claimedTrip,
    );

    return true;
  }

  Future<bool> confirmPickup() async {
    final trip = state.activeTrip;
    if (trip == null) return false;

    state = state.copyWith(isUpdating: true, clearError: true);

    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.patch('${ApiConstants.pickupOrder}/${trip.id}/pickup');
      if (response.statusCode != 200 && response.statusCode != 204) {
        state = state.copyWith(
          isUpdating: false,
          error: 'Server rejected pickup confirmation. Please re-try.',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isUpdating: false,
        error: 'Network error confirming pickup. Please check connection.',
      );
      return false;
    }

    final updated = trip.copyWith(
      currentStep: TripStep.delivering,
      status: 'DISPATCHED',
    );

    state = state.copyWith(
      isUpdating: false,
      activeTrip: updated,
    );

    return true;
  }

  void proceedToHandover() {
    final trip = state.activeTrip;
    if (trip != null) {
      state = state.copyWith(
        activeTrip: trip.copyWith(currentStep: TripStep.handover),
      );
    }
  }

  Future<bool> completeDelivery({
    required bool codCashCollected,
    required double amountCollected,
  }) async {
    final trip = state.activeTrip;
    if (trip == null) return false;

    // INVARIANT GUARD: COD orders require cash collection check
    if (trip.isCod && !codCashCollected) {
      state = state.copyWith(
        error: 'Please verify that cash has been collected from customer.',
      );
      return false;
    }

    state = state.copyWith(isUpdating: true, clearError: true);

    Map<String, dynamic> deliverPayload = {};
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.patch(
        '${ApiConstants.deliverOrder}/${trip.id}/deliver',
        data: {
          'codCashCollected': codCashCollected,
          'amountCollected': amountCollected,
        },
      );
      if (response.statusCode != 200 && response.statusCode != 204) {
        state = state.copyWith(
          isUpdating: false,
          error: 'Server rejected delivery confirmation. Please re-try.',
        );
        return false;
      }
      deliverPayload =
          response.data['data'] as Map<String, dynamic>? ?? {};
    } catch (e) {
      state = state.copyWith(
        isUpdating: false,
        error: 'Network error completing delivery. Please check connection and try again.',
      );
      return false;
    }

    // Server-truth reconciliation: earnings and COD are read from the trip
    // ledger the backend just wrote, so the wallet never drifts from reality.
    final ledger = deliverPayload['tripLedger'] as Map<String, dynamic>?;
    final double serverEarnings =
        (ledger?['deliveryEarnings'] as num?)?.toDouble() ?? trip.payout;
    final double serverCod =
        (ledger?['codCollected'] as num?)?.toDouble() ?? (trip.isCod ? amountCollected : 0.0);

    final completedRecord = RiderCompletedTrip(
      orderId: trip.id,
      orderNumber: trip.orderNumber,
      storeName: trip.store.name,
      customerAddress: trip.customer.address,
      completedAt: DateTime.now(),
      payout: serverEarnings,
      codCollected: serverCod,
      isCod: trip.isCod,
      distanceKm: trip.distanceKm,
    );

    // Credit rider wallet metrics & completed trip history
    ref.read(riderDutyProvider.notifier).simulateTripCompleted(
          payout: serverEarnings,
          codCollected: serverCod,
          tripRecord: completedRecord,
        );

    // Leave order socket room
    ref.read(riderSocketServiceProvider).leaveOrder(trip.id);

    state = state.copyWith(
      isUpdating: false,
      clearActiveTrip: true,
    );

    return true;
  }

  Future<bool> reportDeliveryIssue({required String reason}) async {
    final trip = state.activeTrip;
    if (trip == null) return false;

    state = state.copyWith(isUpdating: true, clearError: true);

    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        '${ApiConstants.claimOrder}/${trip.id}/report-issue',
        data: {'reason': reason},
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        state = state.copyWith(
          isUpdating: false,
          error: 'Failed to report delivery issue. Dispatcher could not be reached.',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isUpdating: false,
        error: 'Network error submitting issue report.',
      );
      return false;
    }

    // Leave order socket room
    ref.read(riderSocketServiceProvider).leaveOrder(trip.id);

    state = state.copyWith(
      isUpdating: false,
      clearActiveTrip: true,
      error: 'Delivery issue recorded: $reason. Order escalated to dispatch.',
    );

    return true;
  }

  void simulateIncomingBroadcast({TripOrder? customTrip}) {
    final trip = customTrip ?? TripOrder.pilotKacchiOrder();
    triggerBroadcastAlert(trip);
  }
}

final riderTripProvider = NotifierProvider<RiderTripNotifier, RiderTripState>(
  RiderTripNotifier.new,
);
