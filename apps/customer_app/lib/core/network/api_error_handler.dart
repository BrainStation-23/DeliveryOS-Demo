import 'package:dio/dio.dart';

class ApiErrorHandler {
  static String parse(Object error, {String fallback = 'An unexpected error occurred. Please try again.'}) {
    if (error is DioException) {
      final responseData = error.response?.data;
      if (responseData is Map<String, dynamic>) {
        final message = responseData['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message.trim();
        }
        if (message is List && message.isNotEmpty) {
          return message.first.toString();
        }
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'Connection timed out. Please check your network and try again.';
      }
      if (error.type == DioExceptionType.connectionError) {
        return 'Network connection error. Please check your internet connection.';
      }
    }
    return fallback;
  }
}
