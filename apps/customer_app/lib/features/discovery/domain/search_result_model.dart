class SearchOutlet {
  final String id;
  final String name;
  final String? brandName;
  final String? logoUrl;
  final String addressText;
  final double distanceKm;

  /// Canonical outlet representation: "Brand - Outlet" — shown once when the
  /// outlet name already carries the brand (no "X - X" doubling).
  String get displayName {
    final brand = (brandName ?? '').trim();
    if (brand.isEmpty) return name;
    if (name == brand || name.startsWith('$brand ') || name.startsWith('$brand—')) {
      return name;
    }
    return '$brand - $name';
  }

  SearchOutlet({
    required this.id,
    required this.name,
    this.brandName,
    this.logoUrl,
    required this.addressText,
    required this.distanceKm,
  });

  factory SearchOutlet.fromJson(Map<String, dynamic> json) {
    return SearchOutlet(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      brandName: json['brandName'] as String? ?? json['brand_name'] as String?,
      logoUrl: json['logoUrl'] as String? ?? json['logo_url'] as String?,
      addressText: json['addressText'] as String? ??
          json['address_text'] as String? ??
          '',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class SearchItem {
  final String id;
  final String name;
  final String? description;
  final double basePrice;
  final String unitType;
  final String? imageUrl;
  final bool isInStock;
  final String vendorId;
  final String vendorName;
  final double distanceKm;

  SearchItem({
    required this.id,
    required this.name,
    this.description,
    required this.basePrice,
    required this.unitType,
    this.imageUrl,
    required this.isInStock,
    required this.vendorId,
    required this.vendorName,
    required this.distanceKm,
  });

  factory SearchItem.fromJson(Map<String, dynamic> json) {
    return SearchItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      basePrice: (json['basePrice'] as num?)?.toDouble() ?? 0.0,
      unitType: json['unitType'] as String? ?? 'piece',
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String?,
      isInStock:
          json['isInStock'] as bool? ?? json['is_in_stock'] as bool? ?? true,
      vendorId:
          json['vendorId'] as String? ?? json['vendor_id'] as String? ?? '',
      vendorName:
          json['vendorName'] as String? ?? json['vendor_name'] as String? ?? '',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class SearchResult {
  final List<SearchOutlet> outlets;
  final List<SearchItem> items;

  SearchResult({this.outlets = const [], this.items = const []});

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    final outletsRaw = json['outlets'] as List<dynamic>? ?? [];
    final itemsRaw = json['items'] as List<dynamic>? ?? [];
    return SearchResult(
      outlets: outletsRaw
          .map((e) => SearchOutlet.fromJson(e as Map<String, dynamic>))
          .toList(),
      items: itemsRaw
          .map((e) => SearchItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
