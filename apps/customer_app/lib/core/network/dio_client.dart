import 'dart:async';
import 'package:dio/dio.dart';
export 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

class DioClient {
  final Dio _dio;
  final LocalStorage? _storage;
  Completer<String?>? _refreshCompleter;
  final List<void Function(String)> _refreshListeners = [];
  final List<void Function(String?)> _sessionExpiredListeners = [];

  DioClient({LocalStorage? storage, Dio? dio})
      : _storage = storage,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: ApiConstants.baseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 10),
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            ) {
    if (dio == null) {
      _dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final token = _storage?.getAccessToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
            return handler.next(options);
          },
          onError: (DioException error, handler) async {
            final refreshed = await _tryRefreshOn401(error);
            if (refreshed != null) {
              final requestOptions = error.requestOptions;
              requestOptions.extra['__retried_after_refresh'] = true;
              requestOptions.headers['Authorization'] = 'Bearer $refreshed';
              try {
                final response = await _dio.fetch(requestOptions);
                return handler.resolve(response);
              } on DioException catch (retryError) {
                if (retryError.response?.statusCode == 401) {
                  await _notifySessionExpired(retryError);
                }
                return handler.next(retryError);
              }
            } else if (error.response?.statusCode == 401) {
              await _notifySessionExpired(error);
            }
            return handler.next(error);
          },
        ),
      );
    }
  }

  /// On a 401 (not from the refresh call itself and not already retried),
  /// rotate the refresh token once and return the new access token.
  /// Single-flight: concurrent 401s await the one in-flight rotation instead
  /// of each firing its own refresh (which would revoke the shared token).
  Future<String?> _tryRefreshOn401(DioException error) async {
    if (error.response?.statusCode != 401 || _storage == null) return null;

    final requestOptions = error.requestOptions;
    if (requestOptions.extra['__retried_after_refresh'] == true) return null;
    if (requestOptions.path.contains('/auth/refresh')) return null;

    final refreshToken = _storage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;

    final inFlight = _refreshCompleter;
    if (inFlight != null) {
      return inFlight.future;
    }

    final completer = Completer<String?>();
    _refreshCompleter = completer;
    try {
      final response = await Dio(BaseOptions(baseUrl: ApiConstants.baseUrl)).post(
        ApiConstants.refreshAuth,
        data: {'refreshToken': refreshToken},
      );
      final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (newAccess == null || newAccess.isEmpty) {
        await _notifySessionExpired(error);
        completer.complete(null);
        return null;
      }

      await _storage.setAccessToken(newAccess);
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await _storage.setRefreshToken(newRefresh);
      }
      for (final listener in _refreshListeners) {
        listener(newAccess);
      }
      completer.complete(newAccess);
      return newAccess;
    } catch (e) {
      // Refresh failed — session is unrecoverable (e.g. account suspended or token revoked)
      await _notifySessionExpired(e is DioException ? e : error);
      completer.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<void> _notifySessionExpired(Object? error) async {
    String? message;
    if (error is DioException && error.response?.data is Map) {
      final data = error.response!.data as Map;
      message = data['message'] as String?;
    }
    await _storage?.clearSession();
    for (final listener in _sessionExpiredListeners) {
      listener(message);
    }
  }

  /// Subscribe to session expiration events (e.g. 401 unrecoverable, account suspended).
  void onSessionExpired(void Function(String?) listener) {
    _sessionExpiredListeners.add(listener);
  }

  /// Subscribe to token rotations (e.g. to re-handshake the realtime socket).
  void onTokenRefresh(void Function(String) listener) {
    _refreshListeners.add(listener);
  }

  Dio get dio => _dio;

  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.get(path, queryParameters: queryParameters, options: options);
  }

  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.post(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.put(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.patch(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.delete(path, data: data, queryParameters: queryParameters, options: options);
  }
}
