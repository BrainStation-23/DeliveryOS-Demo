import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

/// FCM bootstrap for the rider app: initializes Firebase from --dart-define
/// values, registers the device token, and surfaces dispatch alerts even when
/// the socket is not connected. Gracefully no-ops without Firebase config.
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

      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        debugPrint('Push tapped: ${message.data}');
      });

      messaging.onTokenRefresh.listen(_registerToken);
      final token = await messaging.getToken();
      if (token != null) await _registerToken(token);
    } catch (err) {
      debugPrint('PushNotificationService init failed: $err');
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
