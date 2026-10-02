import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/features/banners/domain/banner_action.dart';
import 'package:customer_app/features/banners/domain/banner_model.dart';

BannerModel banner({
  String? actionType,
  String? actionValue,
  String? targetUrl,
  String? targetName,
}) {
  return BannerModel(
    id: 'banner-1',
    title: 'Weekend Feast',
    imageUrl: '/uploads/banner.png',
    actionType: actionType,
    actionValue: actionValue,
    targetUrl: targetUrl,
    targetName: targetName,
  );
}

void main() {
  group('resolveBannerAction', () {
    test('OUTLET banners with a target open the outlet detail screen', () {
      final action = resolveBannerAction(
        banner(actionType: 'OUTLET', actionValue: 'vendor-1', targetName: 'Kacchi Bhai'),
      );
      expect(action, isA<OpenOutlet>());
      expect((action as OpenOutlet).outletId, 'vendor-1');
      expect(action.outletName, 'Kacchi Bhai');
    });

    test('legacy VENDOR action type still routes to the outlet page', () {
      final action = resolveBannerAction(banner(actionType: 'VENDOR', actionValue: 'vendor-1'));
      expect(action, isA<OpenOutlet>());
    });

    test('CATEGORY banners open discovery seeded with the resolved category name', () {
      final action = resolveBannerAction(
        banner(actionType: 'CATEGORY', actionValue: 'category-9', targetName: 'Biryani'),
      );
      expect(action, isA<OpenCategory>());
      expect((action as OpenCategory).categoryId, 'category-9');
      expect(action.categoryName, 'Biryani');
    });

    test('CATEGORY banners fall back to the banner title when the name is absent', () {
      final action = resolveBannerAction(banner(actionType: 'CATEGORY', actionValue: 'category-9'));
      expect((action as OpenCategory).categoryName, 'Weekend Feast');
    });

    test('EXTERNAL banners open absolute http(s) URLs in the browser', () {
      final action = resolveBannerAction(
        banner(actionType: 'EXTERNAL', targetUrl: 'https://example.com/promo'),
      );
      expect(action, isA<OpenExternalUrl>());
      expect((action as OpenExternalUrl).uri.toString(), 'https://example.com/promo');
    });

    test('EXTERNAL banners with non-http schemes degrade to search', () {
      expect(
        resolveBannerAction(banner(actionType: 'EXTERNAL', targetUrl: 'javascript:alert(1)')),
        isA<OpenSearch>(),
      );
      expect(
        resolveBannerAction(banner(actionType: 'EXTERNAL', targetUrl: 'example.com/promo')),
        isA<OpenSearch>(),
      );
      expect(
        resolveBannerAction(banner(actionType: 'EXTERNAL', targetUrl: '')),
        isA<OpenSearch>(),
      );
    });

    test('unknown action types and missing targets degrade to search', () {
      expect(resolveBannerAction(banner()), isA<OpenSearch>());
      expect(resolveBannerAction(banner(actionType: 'OUTLET')), isA<OpenSearch>());
      expect(resolveBannerAction(banner(actionType: 'CATEGORY', actionValue: '')), isA<OpenSearch>());
    });
  });

  group('BannerModel.fromJson deeplink fields', () {
    test('parses targetUrl and targetName from the admin payload', () {
      final model = BannerModel.fromJson({
        'id': 'b1',
        'title': 'Deal',
        'imageUrl': '/uploads/x.png',
        'linkType': 'EXTERNAL',
        'targetId': null,
        'targetUrl': 'https://example.com',
        'targetName': null,
      });
      expect(model.targetUrl, 'https://example.com');
      expect(model.actionType, 'EXTERNAL');
    });
  });
}
