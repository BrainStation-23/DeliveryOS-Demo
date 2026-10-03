import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/core/routing/deeplink_router.dart';

void main() {
  group('DeepLinkRouter.parse', () {
    test('parses relative search path with query param', () {
      final target = DeepLinkRouter.parse('/search?q=pizza');
      expect(target, isA<SearchTarget>());
      expect((target as SearchTarget).query, 'pizza');
    });

    test('parses search with query alternative key', () {
      final target = DeepLinkRouter.parse('/search?query=burgers');
      expect(target, isA<SearchTarget>());
      expect((target as SearchTarget).query, 'burgers');
    });

    test('parses custom scheme search uri', () {
      final target = DeepLinkRouter.parse('deliveryos://search?q=biryani');
      expect(target, isA<SearchTarget>());
      expect((target as SearchTarget).query, 'biryani');
    });

    test('parses outlet route with path param', () {
      final target = DeepLinkRouter.parse('/outlet/vendor-gulshan-1');
      expect(target, isA<OutletTarget>());
      expect((target as OutletTarget).outletId, 'vendor-gulshan-1');
    });

    test('parses outlet route with name query param', () {
      final target = DeepLinkRouter.parse('/outlet/vendor-1?name=Kacchi+Bhai');
      expect(target, isA<OutletTarget>());
      final outlet = target as OutletTarget;
      expect(outlet.outletId, 'vendor-1');
      expect(outlet.outletName, 'Kacchi Bhai');
    });

    test('parses custom scheme outlet route', () {
      final target = DeepLinkRouter.parse('deliveryos://outlet/vendor-dhanmondi-2');
      expect(target, isA<OutletTarget>());
      expect((target as OutletTarget).outletId, 'vendor-dhanmondi-2');
    });

    test('parses cart route', () {
      expect(DeepLinkRouter.parse('/cart'), isA<CartTarget>());
      expect(DeepLinkRouter.parse('deliveryos://cart'), isA<CartTarget>());
    });

    test('parses orders route', () {
      expect(DeepLinkRouter.parse('/orders'), isA<OrdersTarget>());
      expect(DeepLinkRouter.parse('deliveryos://orders'), isA<OrdersTarget>());
      expect(DeepLinkRouter.parse('/order-history'), isA<OrdersTarget>());
    });

    test('parses tracking route with path param', () {
      final target = DeepLinkRouter.parse('/track/ord-999');
      expect(target, isA<TrackingTarget>());
      expect((target as TrackingTarget).orderId, 'ord-999');
    });

    test('parses tracking route with query param', () {
      final target = DeepLinkRouter.parse('/track?id=ord-777&orderNumber=ORD-777');
      expect(target, isA<TrackingTarget>());
      expect((target as TrackingTarget).orderId, 'ord-777');
      expect(target.orderNumber, 'ORD-777');
    });

    test('parses profile and addresses routes', () {
      expect(DeepLinkRouter.parse('/profile'), isA<ProfileTarget>());
      expect(DeepLinkRouter.parse('/addresses'), isA<AddressesTarget>());
      expect(DeepLinkRouter.parse('/address-book'), isA<AddressesTarget>());
    });

    test('parses external web URLs as ExternalUrlTarget', () {
      final target = DeepLinkRouter.parse('https://example.com/promo-terms');
      expect(target, isA<ExternalUrlTarget>());
      expect((target as ExternalUrlTarget).uri.toString(), 'https://example.com/promo-terms');
    });

    test('parses deliveryos.com universal links as in-app targets', () {
      final target = DeepLinkRouter.parse('https://app.deliveryos.com/search?q=khichuri');
      expect(target, isA<SearchTarget>());
      expect((target as SearchTarget).query, 'khichuri');
    });

    test('handles empty or unrecognized links gracefully', () {
      expect(DeepLinkRouter.parse(''), isA<UnknownTarget>());
      expect(DeepLinkRouter.parse('/some-random-unknown-page'), isA<UnknownTarget>());
    });
  });
}
