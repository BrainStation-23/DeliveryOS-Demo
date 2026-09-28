import 'dart:async';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

/// Fired with the orderId when the user taps a push notification for an order.
final StreamController<String> orderNotificationTaps = StreamController<String>.broadcast();

/// FCM bootstrap: initializes Firebase from --dart-define values (no
/// google-services.json required), registers the device token with the backend,
/// and forwards notification taps. Gracefully no-ops when Firebase is not
/// configured (local development).
class PushNotificationService {
  PushNotificationService(this._storage);

  final LocalStorage _storage;
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConstants.baseUrl));
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
      const appId = String.fromEnvironment('FIREBASE_APP_ID');
      const senderId = String.fromEnvironment('FIREBASE_SENDER_ID');
      const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
      if (apiKey.isEmpty || appId.isEmpty || senderId.isEmpty || projectId.isEmpty) {
        debugPrint('PushNotificationService: Firebase dart-defines not set — push disabled.');
        return;
      }

      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
            appId: String.fromEnvironment('FIREBASE_APP_ID'),
            messagingSenderId: String.fromEnvironment('FIREBASE_SENDER_ID'),
            projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
          ),
        );
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);
      final initial = await messaging.getInitialMessage();
      if (initial != null) _handleTap(initial);

      messaging.onTokenRefresh.listen(_registerToken);
      final token = await messaging.getToken();
      if (token != null) await _registerToken(token);
    } catch (err) {
      debugPrint('PushNotificationService init failed: $err');
    }
  }

  Future<void> _handleTap(RemoteMessage message) async {
    final orderId = message.data['orderId'];
    if (orderId is String && orderId.isNotEmpty) {
      orderNotificationTaps.add(orderId);
    }
  }

  Future<void> _registerToken(String token) async {
    final accessToken = _storage.getAccessToken();
    if (accessToken == null || accessToken.isEmpty) return;
    try {
      await _dio.post(
        ApiConstants.registerDeviceToken,
        data: {'fcmToken': token, 'platform': defaultTargetPlatform.name},
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
    } catch (err) {
      debugPrint('Device token registration failed: $err');
    }
  }
}
