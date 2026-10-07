import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:rider_app/core/network/dio_client.dart';
import 'package:rider_app/core/network/socket_service.dart';
import 'package:rider_app/core/storage/local_storage.dart';

class MockSuccessAdapter implements HttpClientAdapter {
  final Map<String, dynamic>? customResponse;
  final int statusCode;

  MockSuccessAdapter({
    this.customResponse,
    this.statusCode = 200,
  });

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bodyString = customResponse != null
        ? customResponse.toString()
        : '{"success": true, "data": []}';
    return ResponseBody.fromString(
      bodyString,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Path-scripted adapter: the first matching path fragment decides the
/// response — a decoded JSON body, or a thrown [DioException] for error paths.
class MockScriptedAdapter implements HttpClientAdapter {
  final Map<String, dynamic> responses;
  final Map<String, DioException> errors;

  MockScriptedAdapter({
    this.responses = const {},
    this.errors = const {},
  });

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    for (final entry in errors.entries) {
      if (options.path.contains(entry.key)) {
        throw entry.value;
      }
    }
    for (final entry in responses.entries) {
      if (options.path.contains(entry.key)) {
        return ResponseBody.fromString(
          jsonEncode(entry.value),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      }
    }
    return ResponseBody.fromString(
      '{"message": "No scripted response for ${options.path}"}',
      404,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio createMockDio({HttpClientAdapter? adapter}) {
  final dio = Dio();
  dio.httpClientAdapter = adapter ?? MockSuccessAdapter();
  return dio;
}


class FakeRiderSocketService extends RiderSocketService {
  @override
  void init(String? token) {}

  @override
  void emitLocationUpdate({
    required double latitude,
    required double longitude,
    double bearing = 0.0,
    double speed = 0.0,
    String? activeOrderId,
  }) {}

  @override
  void joinOrder(String orderId) {}

  @override
  void leaveOrder(String orderId) {}

  @override
  void on(String event, Function(dynamic) handler) {}

  @override
  void off(String event, [Function(dynamic)? handler]) {}

  @override
  void dispose() {}
}

ProviderContainer createMockRiderContainer({
  required LocalStorage storage,
  Dio? dio,
  List<dynamic> additionalOverrides = const [],
}) {
  return ProviderContainer(
    overrides: [
      localStorageProvider.overrideWithValue(storage),
      dioClientProvider.overrideWithValue(dio ?? createMockDio()),
      riderSocketServiceProvider.overrideWithValue(FakeRiderSocketService()),
      ...additionalOverrides,
    ],
  );
}
