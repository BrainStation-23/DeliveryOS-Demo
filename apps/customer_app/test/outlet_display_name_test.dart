import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/features/location/domain/nearby_vendor_model.dart';
import 'package:customer_app/features/discovery/domain/search_result_model.dart';

void main() {
  group('NearbyVendor display name', () {
    test('composes "Brand - Outlet" when the payload carries a brand', () {
      final vendor = NearbyVendor.fromJson({
        'id': 'v1',
        'name': 'Dhanmondi Branch',
        'brandName': 'Burger Point',
        'typeSlug': 'restaurant',
        'addressText': 'Road 27, Dhanmondi',
        'latitude': 23.7461,
        'longitude': 90.376,
        'distanceKm': 1.2,
      });
      expect(vendor.displayName, 'Burger Point - Dhanmondi Branch');
      expect(vendor.name, 'Dhanmondi Branch');
    });

    test('shows the name once when the outlet already carries the brand', () {
      final vendor = NearbyVendor.fromJson({
        'id': 'v1',
        'name': 'Sweet Treats Bakery & Artisan Cafe',
        'brandName': 'Sweet Treats Bakery & Artisan Cafe',
        'typeSlug': 'restaurant',
        'addressText': 'Gulshan',
        'latitude': 0,
        'longitude': 0,
        'distanceKm': 0,
      });
      expect(vendor.displayName, 'Sweet Treats Bakery & Artisan Cafe');

      final prefixed = NearbyVendor.fromJson({
        'id': 'v2',
        'name': 'Burger Point — Gulshan Branch',
        'brandName': 'Burger Point',
        'typeSlug': 'restaurant',
        'addressText': 'Gulshan 2',
        'latitude': 0,
        'longitude': 0,
        'distanceKm': 0,
      });
      expect(prefixed.displayName, 'Burger Point — Gulshan Branch');
    });

    test('falls back to the outlet name when brand is absent (legacy payloads)', () {
      final vendor = NearbyVendor.fromJson({
        'id': 'v1',
        'name': 'Solo Outlet',
        'typeSlug': 'restaurant',
        'addressText': 'Somewhere',
        'latitude': 0,
        'longitude': 0,
        'distanceKm': 0,
      });
      expect(vendor.displayName, 'Solo Outlet');
    });
  });

  group('SearchOutlet display name', () {
    test('composes "Brand - Outlet" from search results', () {
      final outlet = SearchOutlet.fromJson({
        'id': 'o1',
        'name': 'Gulshan Hub',
        'brandName': 'FreshMart',
        'addressText': 'Gulshan 1',
        'distanceKm': 0.8,
      });
      expect(outlet.displayName, 'FreshMart - Gulshan Hub');
    });

    test('falls back to the outlet name without a brand', () {
      final outlet = SearchOutlet.fromJson({
        'id': 'o1',
        'name': 'Standalone',
        'addressText': 'Anywhere',
        'distanceKm': 0,
      });
      expect(outlet.displayName, 'Standalone');
    });
  });
}
