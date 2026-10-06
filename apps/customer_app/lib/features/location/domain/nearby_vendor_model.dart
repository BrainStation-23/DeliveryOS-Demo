import '../../../core/utils/outlet_display_name.dart';

/// Immutable data model representing a nearby outlet/vendor returned by GET /vendors/nearby.
class NearbyVendor {
  final String id;
  final String name;
  final String? brandName;

  /// Canonical outlet representation: "Brand - Outlet", composed at render time.
  String get displayName => outletDisplayName(brandName, name);

  /// Admin-managed outlet business type (ADR-019); drives the home chips.
  final String typeSlug;
  final String? typeName;
  final String? contactPhone;
  final String? logoUrl;
  final String? bannerUrl;
  final String addressText;
  final double latitude;
  final double longitude;
  final double deliveryRadiusKm;
  final int defaultPrepTimeMinutes;
  final bool isActive;
  final bool isBusy;
  final double distanceKm;
  final double deliveryFee;

  const NearbyVendor({
    required this.id,
    required this.name,
    this.brandName,
    this.typeSlug = 'store',
    this.typeName,
    this.contactPhone,
    this.logoUrl,
    this.bannerUrl,
    required this.addressText,
    required this.latitude,
    required this.longitude,
    required this.deliveryRadiusKm,
    required this.defaultPrepTimeMinutes,
    required this.isActive,
    required this.isBusy,
    required this.distanceKm,
    required this.deliveryFee,
  });

  factory NearbyVendor.fromJson(Map<String, dynamic> json) {
    return NearbyVendor(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      brandName: json['brandName'] as String? ?? json['brand_name'] as String?,
      typeSlug: (json['typeSlug'] as String? ?? json['type_slug'] as String? ?? 'store'),
      typeName: json['typeName'] as String? ?? json['type_name'] as String?,
      contactPhone: json['contactPhone'] as String? ?? json['contact_phone'] as String?,
      logoUrl: json['logoUrl'] as String? ?? json['logo_url'] as String?,
      bannerUrl: json['bannerUrl'] as String? ?? json['banner_url'] as String?,
      addressText: json['addressText'] as String? ?? json['address_text'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      deliveryRadiusKm: (json['deliveryRadiusKm'] as num?)?.toDouble() ??
          (json['delivery_radius_km'] as num?)?.toDouble() ??
          5.0,
      defaultPrepTimeMinutes: (json['defaultPrepTimeMinutes'] as num?)?.toInt() ??
          (json['default_prep_time_minutes'] as num?)?.toInt() ??
          25,
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
      isBusy: json['isBusy'] as bool? ?? json['is_busy'] as bool? ?? false,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ??
          (json['distance_km'] as num?)?.toDouble() ??
          0.0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ??
          (json['delivery_fee'] as num?)?.toDouble() ??
          35.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'brandName': brandName,
      'typeSlug': typeSlug,
      'typeName': typeName,
      'contactPhone': contactPhone,
      'logoUrl': logoUrl,
      'bannerUrl': bannerUrl,
      'addressText': addressText,
      'latitude': latitude,
      'longitude': longitude,
      'deliveryRadiusKm': deliveryRadiusKm,
      'defaultPrepTimeMinutes': defaultPrepTimeMinutes,
      'isActive': isActive,
      'isBusy': isBusy,
      'distanceKm': distanceKm,
      'deliveryFee': deliveryFee,
    };
  }
}
