import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';

/// Foreground-service backed location keep-alive so telemetry keeps flowing
/// while the rider's phone is pocketed. The service isolate only captures
/// positions and forwards them to the main isolate, which owns the socket and
/// the throttled HTTP sync (see DutyNotifier).
class BackgroundLocationService {
  static final FlutterBackgroundService _service = FlutterBackgroundService();

  static Future<void> initialize() async {
    final AndroidConfiguration androidConfig = AndroidConfiguration(
      onStart: _onServiceStart,
      isForegroundMode: true,
      notificationChannelId: 'deliveryos_rider_location',
      initialNotificationTitle: 'DeliveryOS — Location Tracking',
      initialNotificationContent: 'Sharing live location while you are online.',
      foregroundServiceNotificationId: 77,
    );
    final IosConfiguration iosConfig = IosConfiguration();

    try {
      await _service.configure(androidConfiguration: androidConfig, iosConfiguration: iosConfig);
    } catch (err) {
      debugPrint('BackgroundLocationService configure failed: $err');
    }
  }

  static Future<void> start() async {
    try {
      if (!await _service.isRunning()) {
        await _service.startService();
      }
    } catch (err) {
      debugPrint('BackgroundLocationService start failed: $err');
    }
  }

  static Future<void> stop() async {
    try {
      if (await _service.isRunning()) {
        // The service isolate must handle this event to cancel its GPS timer
        // and stop itself; see _onServiceStart.
        _service.invoke('stop');
      }
    } catch (err) {
      debugPrint('BackgroundLocationService stop failed: $err');
    }
  }

  /// Stream of fixes produced by the service isolate (main isolate side).
  static Stream<Map<String, dynamic>> get locationUpdates =>
      _service.on('location_update').cast<Map<String, dynamic>>();

  @pragma('vm:entry-point')
  static Future<void> _onServiceStart(ServiceInstance service) async {
    DartPluginRegistrant.ensureInitialized();

    final timer = Timer.periodic(const Duration(seconds: 15), (_) async {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 10),
          ),
        );
        service.invoke('location_update', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'speed': position.speed,
          'bearing': position.heading,
        });
      } catch (_) {
        // GPS fix unavailable in this cycle — retry on the next tick
      }
    });

    // Duty-off / logout must actually end the foreground service; without this
    // handler the 15s GPS loop (and the notification) ran until app death.
    service.on('stop').first.then((_) {
      timer.cancel();
      service.stopSelf();
    });
  }
}
