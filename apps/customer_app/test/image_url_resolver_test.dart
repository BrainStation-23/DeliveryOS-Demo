import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/core/utils/image_url_resolver.dart';
import 'package:customer_app/features/banners/domain/banner_model.dart';

void main() {
  group('resolveImageUrl', () {
    test('returns empty string for null or blank input', () {
      expect(resolveImageUrl(null), '');
      expect(resolveImageUrl(''), '');
      expect(resolveImageUrl('   '), '');
    });

    test('passes absolute URLs through untouched', () {
      expect(
        resolveImageUrl('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600'),
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600',
      );
      expect(resolveImageUrl('http://cdn.example.org/banner.png'), 'http://cdn.example.org/banner.png');
    });

    test('joins relative upload paths onto the API origin, not the /api/v1 base', () {
      final resolved = resolveImageUrl('/uploads/2026-10-02-hero.png');
      expect(resolved, startsWith('http://'));
      expect(resolved.endsWith('/uploads/2026-10-02-hero.png'), isTrue);
      expect(resolved.contains('/api/v1'), isFalse,
          reason: 'static media is served at the origin root');
    });

    test('trims surrounding whitespace before resolving', () {
      expect(resolveImageUrl('  /uploads/a.png  '), endsWith('/uploads/a.png'));
    });
  });

  group('BannerModel.fromJson image resolution', () {
    test('media-library banners render with an absolute URL', () {
      final banner = BannerModel.fromJson({
        'id': 'banner-1',
        'title': 'Pilot Weekend Feast',
        'imageUrl': '/uploads/2026-10-02-feast.jpg',
        'sortOrder': '0',
      });

      expect(banner.imageUrl, startsWith('http://'));
      expect(banner.imageUrl, endsWith('/uploads/2026-10-02-feast.jpg'));
    });

    test('seeded absolute banner URLs keep their CDN host', () {
      final banner = BannerModel.fromJson({
        'id': 'banner-2',
        'title': 'Seed promo',
        'image_url': 'https://images.unsplash.com/photo-1?w=800',
      });

      expect(banner.imageUrl, 'https://images.unsplash.com/photo-1?w=800');
    });
  });
}
