import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import '../localization/language_provider.dart';
import '../storage/local_storage.dart';
import '../../features/auth/providers/auth_provider.dart';

class SocketService {
  io.Socket? _socket;
  final _connectionStateController = StreamController<bool>.broadcast();
  final Map<String, List<Function(dynamic)>> _listeners = {};
  final Set<String> _joinedOrders = {};
  final LocalStorage? _storage;

  SocketService({LocalStorage? storage}) : _storage = storage;

  Stream<bool> get connectionStream => _connectionStateController.stream;
  bool get isConnected => _socket?.connected ?? false;

  void init(String? token) {
    if (_socket != null) {
      if (_socket!.connected) return;
      _socket!.dispose();
    }

    final uri = '${ApiConstants.socketUrl}/events';
    debugPrint('🔌 Connecting to WebSocket: $uri');

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

    // Access tokens rotate (15m): every reconnect must re-read the stored
    // token or the handshake would replay a stale, already-expired credential.
    _socket!.io.on('reconnect_attempt', (_) {
      final fresh = _storage?.getAccessToken();
      if (fresh != null && fresh.isNotEmpty) {
        _socket?.auth = {'token': fresh};
      }
    });

    _socket!.onConnect((_) {
      debugPrint('✅ WebSocket Connected: ${_socket?.id}');
      _connectionStateController.add(true);

      // Re-register all active event listeners upon reconnect
      _listeners.forEach((event, handlers) {
        for (final handler in handlers) {
          _socket!.on(event, handler);
        }
      });

      // Re-join any active order rooms upon reconnect
      for (final orderId in _joinedOrders) {
        debugPrint('📡 Auto re-joining [order:join] for order $orderId on reconnect');
        _socket!.emit('order:join', {'orderId': orderId});
      }
    });

    _socket!.onDisconnect((reason) {
      debugPrint('❌ WebSocket Disconnected: $reason');
      _connectionStateController.add(false);
    });

    _socket!.onConnectError((err) {
      debugPrint('⚠️ WebSocket Connect Error: $err');
      _connectionStateController.add(false);
    });

    _socket!.connect();
  }

  void joinOrder(String orderId) {
    _joinedOrders.add(orderId);
    if (_socket?.connected == true) {
      debugPrint('📡 Emitting [order:join] for order $orderId');
      _socket!.emit('order:join', {'orderId': orderId});
    }
  }

  void leaveOrder(String orderId) {
    _joinedOrders.remove(orderId);
    if (_socket?.connected == true) {
      debugPrint('📡 Emitting [order:leave] for order $orderId');
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

final socketServiceProvider = Provider<SocketService>((ref) {
  final storage = ref.watch(localStorageProvider);
  final service = SocketService(storage: storage);
  final authState = ref.watch(authProvider);

  if (authState.accessToken != null) {
    service.init(authState.accessToken);
  }

  ref.onDispose(() {
    service.dispose();
  });

  return service;
});
