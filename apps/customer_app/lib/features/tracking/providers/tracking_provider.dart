import '../../../core/utils/outlet_display_name.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/socket_service.dart';
import '../../../core/utils/numeric_parser.dart';
import '../../auth/providers/auth_provider.dart';
import '../../location/providers/location_provider.dart';
import '../domain/tracking_models.dart';

class TrackingNotifier extends Notifier<OrderTrackingState> {
  final String orderId;
  TrackingNotifier(this.orderId);

  Timer? _telemetryTimer;

  @override
  OrderTrackingState build() {
    final customerLocation = ref.read(locationProvider).location;
    final socket = ref.watch(socketServiceProvider);

    final initialState = OrderTrackingState(
      orderId: orderId,
      orderNumber: '#ORD-${orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId}',
      stage: OrderStage.placed,
      store: StoreMeta.initial(),
      rider: null,
      customer: CustomerMeta(
        address: customerLocation.addressLine,
        phone: '',
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
      ),
      estimatedMinutesRemaining: 25,
      itemsCount: 0,
      totalAmount: 0.0,
    );

    socket.joinOrder(orderId);

    void handleStatusChanged(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        final newStatusStr = data['newStatus'] as String? ?? '';
        final newStage = OrderStageExtension.fromString(newStatusStr);
        final reason = data['reason'] as String?;
        final paymentStatusUpdate = data['paymentStatus'] as String?;

        RiderMeta? updatedRider = state.rider;
        if (data['riderName'] != null) {
          updatedRider = RiderMeta(
            id: data['riderId'] as String? ?? 'rider-01',
            name: data['riderName'] as String,
            phone: data['riderPhone'] as String? ?? '',
            vehicleType: state.rider?.vehicleType ?? 'Motorcycle',
            rating: state.rider?.rating,
            latitude: state.store.latitude,
            longitude: state.store.longitude,
            speed: 0.0,
          );
        }

        state = state.copyWith(
          stage: newStage,
          rider: updatedRider,
          cancellationReason: reason ?? state.cancellationReason,
          paymentStatus: paymentStatusUpdate ?? state.paymentStatus,
        );
      }
    }

    void handleOrderCancelled(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        final reason = data['reason'] as String?;
        final paymentStatusUpdate = data['paymentStatus'] as String?;
        state = state.copyWith(
          stage: OrderStage.cancelled,
          cancellationReason: reason ?? state.cancellationReason,
          paymentStatus: paymentStatusUpdate ?? state.paymentStatus,
        );
      }
    }

    void handleRiderMoved(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        final loc = data['riderLocation'] as Map<String, dynamic>? ?? {};
        final lat = (loc['latitude'] as num?)?.toDouble();
        final lng = (loc['longitude'] as num?)?.toDouble();
        final bearing = (loc['bearing'] as num?)?.toDouble() ?? 0.0;
        final eta = (data['estimatedMinutesRemaining'] as num?)?.toInt();

        if (lat != null && lng != null && state.rider != null) {
          final currentRider = state.rider!;
          state = state.copyWith(
            rider: currentRider.copyWith(
              latitude: lat,
              longitude: lng,
              bearing: bearing,
            ),
            estimatedMinutesRemaining: eta ?? state.estimatedMinutesRemaining,
          );
        }
      }
    }

    void handlePaymentVerified(dynamic payload) {
      if (payload is Map<String, dynamic>) {
        final data = payload['data'] is Map<String, dynamic>
            ? payload['data'] as Map<String, dynamic>
            : payload;
        final targetOrderId = data['orderId']?.toString();
        if (targetOrderId == null || targetOrderId == orderId) {
          state = state.copyWith(paymentStatus: 'PAID');
          refreshDetails();
        }
      } else {
        state = state.copyWith(paymentStatus: 'PAID');
        refreshDetails();
      }
    }

    socket.on('order:status:changed', handleStatusChanged);
    socket.on('order:status_changed', handleStatusChanged);
    socket.on('order:cancelled', handleOrderCancelled);
    socket.on('order:rider:moved', handleRiderMoved);
    socket.on('order:payment:verified', handlePaymentVerified);

    ref.onDispose(() {
      socket.leaveOrder(orderId);
      socket.off('order:status:changed', handleStatusChanged);
      socket.off('order:status_changed', handleStatusChanged);
      socket.off('order:cancelled', handleOrderCancelled);
      socket.off('order:rider:moved', handleRiderMoved);
      socket.off('order:payment:verified', handlePaymentVerified);
      _telemetryTimer?.cancel();
    });

    Future.microtask(() => refreshDetails());

    return initialState;
  }

  void stopSimulation() {
    _telemetryTimer?.cancel();
  }

  void setStage(OrderStage newStage) {
    state = state.copyWith(stage: newStage);
  }

  Future<bool> cancelOrder(String reason) async {
    if (!ref.mounted) return false;
    try {
      state = state.copyWith(isLoading: true, error: null);
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        '${ApiConstants.orderDetails}/$orderId/cancel',
        data: {'reason': reason},
      );
      if (!ref.mounted) return false;
      if (response.statusCode == 200) {
        final resData = response.data['data'] as Map<String, dynamic>? ?? {};
        final paymentStatus = resData['paymentStatus'] as String?;
        state = state.copyWith(
          stage: OrderStage.cancelled,
          cancellationReason: reason,
          paymentStatus: paymentStatus ?? state.paymentStatus,
          isLoading: false,
        );
        return true;
      }
    } catch (e) {
      debugPrint('Error cancelling order: $e');
      if (ref.mounted) {
        state = state.copyWith(
          isLoading: false,
          error: 'Failed to cancel order: ${e.toString()}',
        );
      }
    }
    return false;
  }

  Future<bool> switchToCOD() async {
    if (!ref.mounted) return false;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post('${ApiConstants.orderDetails}/$orderId/switch-cod');
      if (!ref.mounted) return false;
      if (response.statusCode == 200) {
        state = state.copyWith(
          paymentMethod: 'CASH_ON_DELIVERY',
          isLoading: false,
        );
        await refreshDetails();
        return true;
      }
    } catch (e) {
      debugPrint('Error switching payment method to COD: $e');
      if (ref.mounted) {
        state = state.copyWith(
          isLoading: false,
          error: 'Failed to switch to COD. Please try again.',
        );
      }
    }
    return false;
  }

  Future<void> refreshDetails() async {
    if (!ref.mounted) return;
    try {
      state = state.copyWith(isLoading: true, error: null);
      final dio = ref.read(dioClientProvider);
      final response = await dio.get('${ApiConstants.orderDetails}/$orderId');
      if (!ref.mounted) return;
      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>? ?? {};
        final statusStr = data['status'] as String? ?? 'PLACED';
        final vendor = data['vendor'] as Map<String, dynamic>? ?? {};
        final items = (data['orderItems'] as List<dynamic>?) ?? [];
        final rejectionReason = data['rejectionReason'] as String?;
        final paymentStatus = data['paymentStatus'] as String?;
        final paymentMethod = data['paymentMethod'] as String?;

        final storeMeta = StoreMeta(
          id: vendor['id'] as String? ?? state.store.id,
          name: outletDisplayName(
            vendor['brandName'] as String?,
            vendor['name'] as String? ?? state.store.name,
          ),
          address: vendor['addressText'] as String? ?? state.store.address,
          phone: vendor['contactPhone'] as String? ?? vendor['phone'] as String? ?? state.store.phone,
          latitude: parseDouble(vendor['latitude'], state.store.latitude),
          longitude: parseDouble(vendor['longitude'], state.store.longitude),
        );

        final riderData = data['rider'] as Map<String, dynamic>?;
        RiderMeta? riderMeta;
        if (riderData != null) {
          final user = riderData['user'] as Map<String, dynamic>? ?? {};
          final rawVehicle = riderData['vehicleType'] as String?;
          final vehicle = rawVehicle == null || rawVehicle.isEmpty
              ? 'Motorcycle'
              : rawVehicle[0].toUpperCase() + rawVehicle.substring(1);
          riderMeta = RiderMeta(
            id: riderData['id'] as String? ?? 'rider-01',
            name: user['fullName'] as String? ?? 'Delivery Courier',
            phone: user['phone'] as String? ?? '',
            vehicleType: vehicle,
            rating: null,
            latitude: storeMeta.latitude,
            longitude: storeMeta.longitude,
            speed: 0.0,
          );
        }

        state = state.copyWith(
          orderNumber: data['orderNumber'] as String? ?? state.orderNumber,
          stage: OrderStageExtension.fromString(statusStr),
          store: storeMeta,
          rider: riderMeta ?? state.rider,
          itemsCount: items.isNotEmpty ? items.length : state.itemsCount,
          totalAmount: parseDouble(data['totalAmount'], state.totalAmount),
          cancellationReason: rejectionReason ?? state.cancellationReason,
          paymentStatus: paymentStatus ?? state.paymentStatus,
          paymentMethod: paymentMethod ?? state.paymentMethod,
          isLoading: false,
          error: null,
        );
      }
    } catch (e) {
      debugPrint('Error refreshing order tracking details: $e');
      if (ref.mounted) {
        state = state.copyWith(
          isLoading: false,
          error: 'Failed to load tracking details. Tap retry to reload.',
        );
      }
    }
  }
}

final trackingProvider =
    NotifierProvider.autoDispose.family<TrackingNotifier, OrderTrackingState, String>(
  TrackingNotifier.new,
);
