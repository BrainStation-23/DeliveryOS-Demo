import 'dart:async';

import 'package:dio/dio.dart';
export 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

final dioClientProvider = Provider<Dio>((ref) {
  final storage = ref.watch(localStorageProvider);

  // Single-flight rotation: concurrent 401s share one refresh call. Each
  // caller awaits the same Future instead of racing separate rotations that
  // would revoke one another's refresh tokens.
  Future<String?>? inFlightRefresh;

  Future<String?> doRotateRefreshToken() async {
    try {
      final refreshResponse = await Dio(BaseOptions(baseUrl: ApiConstants.baseUrl)).post(
        ApiConstants.refreshAuth,
        data: {'refreshToken': storage.getRefreshToken()},
      );
      final data =
          refreshResponse.data['data'] as Map<String, dynamic>? ?? refreshResponse.data as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;

      if (newAccess != null && newAccess.isNotEmpty) {
        await storage.setAccessToken(newAccess);
        if (newRefresh != null && newRefresh.isNotEmpty) {
          await storage.setRefreshToken(newRefresh);
        }
        return newAccess;
      }
      return null;
    } catch (_) {
      // Refresh failed — session is unrecoverable
      await storage.clearAuth();
      return null;
    }
  }

  Future<String?> rotateRefreshToken() {
    final inFlight = inFlightRefresh;
    if (inFlight != null) return inFlight;

    final future = doRotateRefreshToken();
    inFlightRefresh = future;
    // Clear the cached rotation once it settles so a past failure can never
    // wedge future refresh attempts.
    future.whenComplete(() {
      if (identical(inFlightRefresh, future)) {
        inFlightRefresh = null;
      }
    });
    return future;
  }

  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = storage.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException error, handler) async {
        final requestOptions = error.requestOptions;
        final canRefresh = error.response?.statusCode == 401 &&
            requestOptions.extra['__retried_after_refresh'] != true &&
            !requestOptions.path.contains('/auth/refresh') &&
            (storage.getRefreshToken()?.isNotEmpty ?? false);

        if (canRefresh) {
          final newAccess = await rotateRefreshToken();
          if (newAccess != null) {
            requestOptions.extra['__retried_after_refresh'] = true;
            requestOptions.headers['Authorization'] = 'Bearer $newAccess';
            try {
              final response = await dio.fetch(requestOptions);
              return handler.resolve(response);
            } on DioException catch (retryError) {
              return handler.next(retryError);
            }
          }
        }
        return handler.next(error);
      },
    ),
  );

  return dio;
});
