import 'dart:async';
import 'package:dio/dio.dart';
export 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

class DioClient {
  final Dio _dio;
  final LocalStorage? _storage;
  bool _isRefreshing = false;
  final List<void Function(String)> _refreshListeners = [];

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
                return handler.next(retryError);
              }
            }
            return handler.next(error);
          },
        ),
      );
    }
  }

  /// On a 401 (not from the refresh call itself and not already retried),
  /// rotate the refresh token once and return the new access token.
  Future<String?> _tryRefreshOn401(DioException error) async {
    if (error.response?.statusCode != 401 || _storage == null) return null;

    final requestOptions = error.requestOptions;
    if (requestOptions.extra['__retried_after_refresh'] == true) return null;
    if (requestOptions.path.contains('/auth/refresh')) return null;

    final refreshToken = _storage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;

    if (_isRefreshing) return null;
    _isRefreshing = true;
    try {
      final response = await Dio(BaseOptions(baseUrl: ApiConstants.baseUrl)).post(
        ApiConstants.refreshAuth,
        data: {'refreshToken': refreshToken},
      );
      final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (newAccess == null || newAccess.isEmpty) return null;

      await _storage.setAccessToken(newAccess);
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await _storage.setRefreshToken(newRefresh);
      }
      for (final listener in _refreshListeners) {
        listener(newAccess);
      }
      return newAccess;
    } catch (_) {
      // Refresh failed — session is unrecoverable
      await _storage.clearSession();
      return null;
    } finally {
      _isRefreshing = false;
    }
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
