import 'package:dio/dio.dart';
export 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

final dioClientProvider = Provider<Dio>((ref) {
  final storage = ref.watch(localStorageProvider);
  var isRefreshing = false;

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

        if (canRefresh && !isRefreshing) {
          isRefreshing = true;
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
              requestOptions.extra['__retried_after_refresh'] = true;
              requestOptions.headers['Authorization'] = 'Bearer $newAccess';
              isRefreshing = false;
              final response = await dio.fetch(requestOptions);
              return handler.resolve(response);
            }
          } catch (_) {
            // Refresh failed — session is unrecoverable
            await storage.clearAuth();
          } finally {
            isRefreshing = false;
          }
        }
        return handler.next(error);
      },
    ),
  );

  return dio;
});
