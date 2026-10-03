import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../features/addresses/presentation/address_book_screen.dart';
import '../../features/cart/presentation/cart_screen.dart';
import '../../features/discovery/presentation/search_screen.dart';
import '../../features/orders/presentation/order_history_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/store/presentation/outlet_detail_screen.dart';
import '../../features/tracking/presentation/order_tracking_screen.dart';
import '../../main.dart';

/// Strongly-typed target for any parsed deep link in Customer App.
sealed class DeepLinkTarget {
  const DeepLinkTarget();
}

class SearchTarget extends DeepLinkTarget {
  final String? query;
  const SearchTarget({this.query});
}

class OutletTarget extends DeepLinkTarget {
  final String outletId;
  final String? outletName;
  const OutletTarget({required this.outletId, this.outletName});
}

class CartTarget extends DeepLinkTarget {
  const CartTarget();
}

class OrdersTarget extends DeepLinkTarget {
  const OrdersTarget();
}

class TrackingTarget extends DeepLinkTarget {
  final String orderId;
  final String? orderNumber;
  const TrackingTarget({required this.orderId, this.orderNumber});
}

class ProfileTarget extends DeepLinkTarget {
  const ProfileTarget();
}

class AddressesTarget extends DeepLinkTarget {
  const AddressesTarget();
}

class ExternalUrlTarget extends DeepLinkTarget {
  final Uri uri;
  const ExternalUrlTarget({required this.uri});
}

class UnknownTarget extends DeepLinkTarget {
  final String raw;
  const UnknownTarget({required this.raw});
}

/// Independent, scalable, lightweight deep link parser and router for Customer App.
/// Supports custom schemes (`deliveryos://search?q=pizza`) and route paths (`/search?q=pizza`).
class DeepLinkRouter {
  static const Set<String> supportedCustomSchemes = {'deliveryos', 'app'};

  /// Parses a raw link string into a strongly-typed [DeepLinkTarget].
  static DeepLinkTarget parse(String rawLink) {
    final trimmed = rawLink.trim();
    if (trimmed.isEmpty) {
      return const UnknownTarget(raw: '');
    }

    final uri = Uri.tryParse(trimmed);

    // Absolute http(s) URLs
    if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) {
      if (uri.host == 'app.deliveryos.com' || uri.host == 'deliveryos.com') {
        return _parsePathAndQuery(uri.path, uri.queryParameters);
      }
      return ExternalUrlTarget(uri: uri);
    }

    // Custom schemes (e.g. deliveryos://cart, deliveryos://search?q=pizza)
    if (uri != null && uri.hasScheme && supportedCustomSchemes.contains(uri.scheme.toLowerCase())) {
      final host = uri.host.toLowerCase();
      final path = uri.path;
      final fullPath = host.isNotEmpty ? '/$host$path' : path;
      return _parsePathAndQuery(fullPath, uri.queryParameters);
    }

    // Internal path (e.g. /search?q=pizza, /cart)
    if (uri != null) {
      return _parsePathAndQuery(uri.path, uri.queryParameters);
    }

    return UnknownTarget(raw: rawLink);
  }

  static DeepLinkTarget _parsePathAndQuery(String path, Map<String, String> query) {
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final segments = cleanPath.split('/').where((s) => s.isNotEmpty).toList();

    if (segments.isEmpty) {
      return const UnknownTarget(raw: '/');
    }

    final root = segments[0].toLowerCase();

    switch (root) {
      case 'search':
        final q = query['q'] ?? query['query'] ?? (segments.length > 1 ? segments[1] : null);
        return SearchTarget(query: q);

      case 'outlet':
      case 'store':
      case 'vendor':
        if (segments.length > 1) {
          final id = segments[1];
          final name = query['name'];
          return OutletTarget(outletId: id, outletName: name);
        } else if (query.containsKey('id')) {
          return OutletTarget(outletId: query['id']!, outletName: query['name']);
        }
        return const SearchTarget();

      case 'cart':
        return const CartTarget();

      case 'orders':
      case 'order-history':
        if (segments.length > 1) {
          return TrackingTarget(orderId: segments[1]);
        }
        return const OrdersTarget();

      case 'track':
      case 'tracking':
        final orderId = segments.length > 1 ? segments[1] : query['orderId'] ?? query['id'];
        if (orderId != null && orderId.isNotEmpty) {
          return TrackingTarget(orderId: orderId, orderNumber: query['orderNumber']);
        }
        return const OrdersTarget();

      case 'profile':
        return const ProfileTarget();

      case 'addresses':
      case 'address-book':
        return const AddressesTarget();

      default:
        return UnknownTarget(raw: path);
    }
  }

  /// Pushes the matching screen onto [context] or launches the browser.
  static Future<bool> navigate(BuildContext context, String rawLink) async {
    final target = parse(rawLink);
    return navigateTarget(context, target);
  }

  /// Pushes the matching screen using [customerNavigatorKey] (context-free navigation).
  static Future<bool> navigateWithGlobalKey(String rawLink) async {
    final nav = customerNavigatorKey.currentState;
    if (nav == null) return false;
    final target = parse(rawLink);
    return navigateTargetWithNavigator(nav, target);
  }

  /// Navigates a resolved [DeepLinkTarget] using a [BuildContext].
  static Future<bool> navigateTarget(BuildContext context, DeepLinkTarget target) async {
    final navigator = Navigator.of(context);
    return navigateTargetWithNavigator(navigator, target);
  }

  /// Navigates a resolved [DeepLinkTarget] using a [NavigatorState].
  static Future<bool> navigateTargetWithNavigator(NavigatorState navigator, DeepLinkTarget target) async {
    switch (target) {
      case SearchTarget(:final query):
        navigator.push(
          MaterialPageRoute(builder: (_) => SearchScreen(initialQuery: query)),
        );
        return true;

      case OutletTarget(:final outletId, :final outletName):
        navigator.push(
          MaterialPageRoute(
            builder: (_) => OutletDetailScreen(
              vendorId: outletId,
              initialVendorName: outletName ?? '',
            ),
          ),
        );
        return true;

      case CartTarget():
        navigator.push(
          MaterialPageRoute(builder: (_) => const CartScreen()),
        );
        return true;

      case OrdersTarget():
        navigator.push(
          MaterialPageRoute(builder: (_) => const OrderHistoryScreen()),
        );
        return true;

      case TrackingTarget(:final orderId, :final orderNumber):
        navigator.push(
          MaterialPageRoute(
            builder: (_) => OrderTrackingScreen(
              orderId: orderId,
              orderNumber: orderNumber ?? '',
            ),
          ),
        );
        return true;

      case ProfileTarget():
        navigator.push(
          MaterialPageRoute(builder: (_) => const ProfileScreen()),
        );
        return true;

      case AddressesTarget():
        navigator.push(
          MaterialPageRoute(builder: (_) => const AddressBookScreen()),
        );
        return true;

      case ExternalUrlTarget(:final uri):
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return true;

      case UnknownTarget():
        navigator.push(
          MaterialPageRoute(builder: (_) => const SearchScreen()),
        );
        return false;
    }
  }
}
