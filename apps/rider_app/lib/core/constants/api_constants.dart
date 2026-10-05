import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  /// Release builds must pass API_BASE_URL via --dart-define
  /// (e.g. --dart-define=API_BASE_URL=https://api.deliveryos.example.com/api/v1).
  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _definedSocketUrl = String.fromEnvironment('SOCKET_BASE_URL');

  static String get baseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    if (kIsWeb) {
      return 'http://localhost:4000/api/v1';
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:4000/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }

  static String get socketUrl {
    if (_definedSocketUrl.isNotEmpty) return _definedSocketUrl;
    if (kIsWeb) {
      return 'http://localhost:4000';
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:4000';
    }
    return 'http://localhost:4000';
  }

  static const String requestOtp = '/auth/otp/request';
  static const String verifyOtp = '/auth/otp/verify';
  static const String refreshAuth = '/auth/refresh';
  static const String registerDeviceToken = '/auth/device-token';

  static const String riderProfile = '/rider/profile';
  static const String toggleDuty = '/rider/duty';
  static const String depositCash = '/rider/cash/deposit';
  static const String claimOrder = '/rider/orders';
  static const String pickupOrder = '/rider/orders';
  static const String deliverOrder = '/rider/orders';
  static const String trips = '/rider/trips';
  static const String activeTrip = '/rider/active-trip';
}
