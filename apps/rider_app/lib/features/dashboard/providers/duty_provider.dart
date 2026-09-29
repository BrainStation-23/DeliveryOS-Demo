import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/socket_service.dart';
import '../../../core/services/background_location_service.dart';
import '../../../core/storage/local_storage.dart';
import '../../auth/domain/auth_models.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/duty_models.dart';

class RiderDutyNotifier extends Notifier<RiderDutyState> {
  Timer? _beaconTimer;
  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<Map<String, dynamic>>? _backgroundLocationSubscription;
  DateTime? _lastHttpSync;

  @override
  RiderDutyState build() {
    final storage = ref.watch(localStorageProvider);
    final isOnlineStored = storage.getIsOnline();
    final auth = ref.watch(riderAuthProvider);
    final profile = auth.profile;

    ref.onDispose(() {
      _beaconTimer?.cancel();
      _positionSubscription?.cancel();
      _backgroundLocationSubscription?.cancel();
    });

    final initialCodCash = profile?.cashInHand ?? 0.0;
    final initialTodayEarnings = profile?.earningsBalance ?? 0.0;
    final initialWeeklyEarnings = initialTodayEarnings;

    final initialState = RiderDutyState(
      isOnline: isOnlineStored && (profile?.isApproved ?? false),
      isBeaconing: isOnlineStored && (profile?.isApproved ?? false),
      todayTrips: profile?.completedTripsCount ?? 0,
      todayEarnings: initialTodayEarnings,
      weeklyTrips: profile?.completedTripsCount ?? 0,
      weeklyEarnings: initialWeeklyEarnings,
      codCashInHand: initialCodCash,
      cashSafetyLimit: profile?.maxCashLimit ?? 5000.0,
      completedTrips: const [],
      statusMessage: (isOnlineStored && (profile?.isApproved ?? false))
          ? 'Online • GPS Radar Active'
          : 'Offline • Tap switch to go Online',
    );

    if (initialState.isOnline) {
      _startGpsBeaconing();
    }

    if (profile?.isApproved ?? false) {
      Future.microtask(() => fetchDailyTrips());
    }

    return initialState;
  }

  void stopBeaconing() {
    _beaconTimer?.cancel();
    _beaconTimer = null;
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _backgroundLocationSubscription?.cancel();
    _backgroundLocationSubscription = null;
    state = state.copyWith(isBeaconing: false);
  }

  /// Full teardown used on logout: stops GPS streams, the background
  /// foreground-service, and its telemetry subscription.
  Future<void> teardownForLogout() async {
    stopBeaconing();
    await BackgroundLocationService.stop();
  }

  Future<bool> toggleDuty({bool? forceState}) async {
    final auth = ref.read(riderAuthProvider);
    final profile = auth.profile;

    // INVARIANT GUARD: Unapproved account is strictly blocked from going online
    if (profile == null || !profile.isApproved || profile.status == AccountStatus.pendingApproval) {
      state = state.copyWith(
        isOnline: false,
        isBeaconing: false,
        error: 'Unapproved account: Duty switch is locked until administrator approval.',
        statusMessage: 'Locked • Awaiting Admin Approval',
      );
      return false;
    }

    final targetState = forceState ?? !state.isOnline;
    state = state.copyWith(isToggling: true, clearError: true);

    try {
      final dio = ref.read(dioClientProvider);
      await dio.patch(
        ApiConstants.toggleDuty,
        data: {'isOnline': targetState},
      );
    } on DioException catch (dioErr) {
      final statusCode = dioErr.response?.statusCode;
      if (statusCode == 403 || statusCode == 400) {
        final resData = dioErr.response?.data;
        final msg = resData is Map ? (resData['message'] ?? dioErr.message) : (dioErr.message ?? 'Duty switch failed');
        state = state.copyWith(
          isToggling: false,
          error: msg.toString(),
        );
        return false;
      }
      // Offline fallback handling
    } catch (_) {
      // Offline fallback handling
    }

    final storage = ref.read(localStorageProvider);
    await storage.setIsOnline(targetState);

    if (targetState) {
      _startGpsBeaconing();
      await BackgroundLocationService.start();
      _bindBackgroundLocationStream();
      state = state.copyWith(
        isOnline: true,
        isBeaconing: true,
        isToggling: false,
        statusMessage: 'Online • GPS Radar Active • Ready for Trips',
      );
    } else {
      stopBeaconing();
      await BackgroundLocationService.stop();
      state = state.copyWith(
        isOnline: false,
        isBeaconing: false,
        isToggling: false,
        speed: 0.0,
        statusMessage: 'Offline • Tap switch to go Online',
      );
    }

    return true;
  }

  /// Foreground-service fixes (phone pocketed / screen off) flow through the
  /// same telemetry path as the in-app position stream.
  void _bindBackgroundLocationStream() {
    if (_backgroundLocationSubscription != null) return;
    try {
      _backgroundLocationSubscription =
          BackgroundLocationService.locationUpdates.listen((fix) {
        if (!state.isOnline) return;
        final latitude = (fix['latitude'] as num?)?.toDouble();
        final longitude = (fix['longitude'] as num?)?.toDouble();
        final speed = (fix['speed'] as num?)?.toDouble() ?? 0.0;
        if (latitude == null || longitude == null) return;
        state = state.copyWith(
          latitude: latitude,
          longitude: longitude,
          speed: speed,
          bearing: (fix['bearing'] as num?)?.toDouble() ?? state.bearing,
          lastBeaconTimestamp: DateTime.now(),
          isBeaconing: true,
        );
        _dispatchTelemetryToBackend(latitude, longitude, speed);
      });
    } catch (_) {
      // Background service unsupported (e.g. tests / non-mobile) — skip
    }
  }

  void _startGpsBeaconing() {
    _beaconTimer?.cancel();
    _positionSubscription?.cancel();

    try {
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen(
        (position) {
          if (!state.isOnline) return;
          state = state.copyWith(
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            bearing: position.heading,
            lastBeaconTimestamp: DateTime.now(),
            isBeaconing: true,
          );
          _dispatchTelemetryToBackend(position.latitude, position.longitude, position.speed);
        },
        onError: (error) {
          // Never fabricate coordinates: surface the GPS failure instead
          state = state.copyWith(
            isBeaconing: false,
            statusMessage: 'GPS signal unavailable — check location settings',
          );
        },
      );
    } catch (_) {
      state = state.copyWith(
        isBeaconing: false,
        statusMessage: 'GPS unavailable — check location settings',
      );
    }
  }

  Future<void> _dispatchTelemetryToBackend(double lat, double lng, double speed) async {
    try {
      // 1. WebSocket zero-latency streaming to Redis geospatial index & live customer map
      final socket = ref.read(riderSocketServiceProvider);
      socket.emitLocationUpdate(
        latitude: lat,
        longitude: lng,
        speed: speed,
        bearing: state.bearing,
        activeOrderId: state.activeOrderId,
      );

      // 2. HTTP persistent state sync, throttled to one call per 30 seconds
      final now = DateTime.now();
      final lastSync = _lastHttpSync;
      if (lastSync == null || now.difference(lastSync).inSeconds >= 30) {
        _lastHttpSync = now;
        final dio = ref.read(dioClientProvider);
        await dio.patch(
          ApiConstants.toggleDuty,
          data: {
            'isOnline': true,
            'latitude': lat,
            'longitude': lng,
            'speed': speed,
          },
        );
      }
    } catch (_) {
      // Telemetry dispatch
    }
  }

  void simulateTripCompleted({
    required double payout,
    double? codCollected,
    RiderCompletedTrip? tripRecord,
  }) {
    final updatedTrips = [
      if (tripRecord != null) tripRecord,
      ...state.completedTrips,
    ];

    state = state.copyWith(
      todayTrips: state.todayTrips + 1,
      todayEarnings: state.todayEarnings + payout,
      weeklyTrips: state.weeklyTrips + 1,
      weeklyEarnings: state.weeklyEarnings + payout,
      codCashInHand: state.codCashInHand + (codCollected ?? 0.0),
      completedTrips: updatedTrips,
    );
  }

  Future<void> fetchDailyTrips() async {
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(ApiConstants.trips);
      if (response.statusCode == 200 && response.data is Map && response.data['data'] is List) {
        final list = response.data['data'] as List;
        final trips = list.map((item) {
          final m = item as Map<String, dynamic>;
          return RiderCompletedTrip(
            orderId: m['id']?.toString() ?? '',
            orderNumber: m['orderNumber']?.toString() ?? 'ORD',
            storeName: m['vendorName']?.toString() ?? 'Store',
            customerAddress: m['customerAddress']?.toString() ?? '',
            completedAt: m['deliveredAt'] != null
                ? DateTime.tryParse(m['deliveredAt'].toString()) ?? DateTime.now()
                : (m['placedAt'] != null
                    ? DateTime.tryParse(m['placedAt'].toString()) ?? DateTime.now()
                    : DateTime.now()),
            payout: (m['payout'] as num?)?.toDouble() ?? 0.0,
            codCollected: (m['codCollected'] as num?)?.toDouble() ?? 0.0,
            isCod: m['isCod'] == true,
            distanceKm: (m['distanceKm'] as num?)?.toDouble() ?? 0.0,
          );
        }).toList();

        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final todayList = trips.where((t) => t.completedAt.isAfter(today)).toList();
        final todayEarnings = todayList.fold<double>(0.0, (sum, t) => sum + t.payout);

        state = state.copyWith(
          completedTrips: trips,
          todayTrips: todayList.length,
          todayEarnings: todayEarnings,
        );
      }
    } catch (_) {
      // Retain offline cache/state
    }
  }

  Future<bool> depositCashToHub({double? amount}) async {
    final depositAmount = amount ?? state.codCashInHand;
    if (depositAmount <= 0) return false;

    state = state.copyWith(isDepositingCash: true, clearError: true);

    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.depositCash,
        data: {
          'amount': depositAmount,
          'notes': 'Hub cash settlement via Rider App',
        },
      );

      double newBalance = (state.codCashInHand - depositAmount).clamp(0.0, double.infinity);
      if (response.data is Map && response.data['data'] is Map) {
        final serverCash = response.data['data']['cashInHand'];
        if (serverCash is num) {
          newBalance = serverCash.toDouble();
        }
      }

      state = state.copyWith(
        codCashInHand: newBalance,
        isDepositingCash: false,
      );

      return true;
    } on DioException catch (dioErr) {
      final resData = dioErr.response?.data;
      final msg = resData is Map ? (resData['message'] ?? 'Cash deposit failed.') : 'Cash deposit failed.';
      state = state.copyWith(
        isDepositingCash: false,
        error: msg.toString(),
      );
      return false;
    } catch (_) {
      state = state.copyWith(
        isDepositingCash: false,
        error: 'Network connection error.',
      );
      return false;
    }
  }
}

final riderDutyProvider = NotifierProvider<RiderDutyNotifier, RiderDutyState>(
  RiderDutyNotifier.new,
);
