import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';
import '../../features/auth/providers/auth_provider.dart';

class RiderSocketService {
  io.Socket? _socket;
  final _connectionStateController = StreamController<bool>.broadcast();
  final Map<String, List<Function(dynamic)>> _listeners = {};
  final Set<String> _joinedOrders = {};

  Stream<bool> get connectionStream => _connectionStateController.stream;
  bool get isConnected => _socket?.connected ?? false;

  void init(String? token) {
    if (_socket != null) {
      if (_socket!.connected) return;
      _socket!.dispose();
    }

    final uri = '${ApiConstants.socketUrl}/events';
    debugPrint('🔌 [Rider] Connecting to WebSocket: $uri');

    _socket = io.io(
      uri,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(2000)
          .setAuth({'token': token ?? ''})
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('✅ [Rider] WebSocket Connected: ${_socket?.id}');
      _connectionStateController.add(true);

      // Auto re-register all persistent event listeners upon reconnect
      _listeners.forEach((event, handlers) {
        for (final handler in handlers) {
          _socket!.on(event, handler);
        }
      });

      // Auto re-join all active order rooms upon reconnect
      for (final orderId in _joinedOrders) {
        debugPrint('📡 [Rider] Auto re-joining order $orderId on reconnect');
        _socket!.emit('order:join', {'orderId': orderId});
      }
    });

    _socket!.onDisconnect((reason) {
      debugPrint('❌ [Rider] WebSocket Disconnected: $reason');
      _connectionStateController.add(false);
    });

    _socket!.onConnectError((err) {
      debugPrint('⚠️ [Rider] WebSocket Connect Error: $err');
      _connectionStateController.add(false);
    });

    _socket!.connect();
  }

  void emitLocationUpdate({
    required double latitude,
    required double longitude,
    double bearing = 0.0,
    double speed = 0.0,
    String? activeOrderId,
  }) {
    if (_socket?.connected == true) {
      _socket!.emit('rider:location:update', {
        'latitude': latitude,
        'longitude': longitude,
        'bearing': bearing,
        'speed': speed,
        if (activeOrderId != null) 'activeOrderId': activeOrderId,
      });
    }
  }

  void joinOrder(String orderId) {
    _joinedOrders.add(orderId);
    if (_socket?.connected == true) {
      _socket!.emit('order:join', {'orderId': orderId});
    }
  }

  void leaveOrder(String orderId) {
    _joinedOrders.remove(orderId);
    if (_socket?.connected == true) {
      _socket!.emit('order:leave', {'orderId': orderId});
    }
  }

  void on(String event, Function(dynamic) handler) {
    _listeners.putIfAbsent(event, () => []).add(handler);
    _socket?.on(event, handler);
  }

  void off(String event, [Function(dynamic)? handler]) {
    if (handler != null) {
      _listeners[event]?.remove(handler);
      _socket?.off(event, handler);
    } else {
      _listeners.remove(event);
      _socket?.off(event);
    }
  }

  void dispose() {
    _listeners.clear();
    _joinedOrders.clear();
    _socket?.dispose();
    _socket = null;
    _connectionStateController.close();
  }
}

final riderSocketServiceProvider = Provider<RiderSocketService>((ref) {
  final service = RiderSocketService();
  final authState = ref.watch(riderAuthProvider);
  final storage = ref.watch(localStorageProvider);

  if (authState.isAuthenticated) {
    final token = storage.getAccessToken();
    if (token != null) {
      service.init(token);
    }
  }

  ref.onDispose(() {
    service.dispose();
  });

  return service;
});
