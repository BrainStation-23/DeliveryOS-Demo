import '../../../../core/utils/numeric_parser.dart';

class VariantModel {
  final String id;
  final String name;
  final double price;
  final bool isInStock;

  VariantModel({
    required this.id,
    required this.name,
    required this.price,
    required this.isInStock,
  });

  factory VariantModel.fromJson(Map<String, dynamic> json) {
    return VariantModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      price: parseDouble(json['priceModifier'] ?? json['price_modifier'] ?? json['price']),
      isInStock: json['isInStock'] as bool? ?? json['is_in_stock'] as bool? ?? true,
    );
  }
}

class ProductModel {
  final String id;
  final String name;
  final String? description;
  final double basePrice;
  final String unitType;
  final String? imageUrl;
  final bool isInStock;
  final List<VariantModel> variants;

  ProductModel({
    required this.id,
    required this.name,
    this.description,
    required this.basePrice,
    required this.unitType,
    this.imageUrl,
    required this.isInStock,
    this.variants = const [],
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final variantsRaw = json['variants'] as List<dynamic>? ?? [];

    return ProductModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      basePrice: parseDouble(json['basePrice'] ?? json['base_price']),
      unitType: json['unitType'] as String? ?? json['unit_type'] as String? ?? 'piece',
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String?,
      isInStock: json['isInStock'] as bool? ?? json['is_in_stock'] as bool? ?? true,
      variants: variantsRaw.map((e) => VariantModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class CategoryModel {
  final String id;
  final String name;
  final int sortOrder;
  final List<ProductModel> products;

  CategoryModel({
    required this.id,
    required this.name,
    this.sortOrder = 0,
    this.products = const [],
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    final productsRaw = json['products'] as List<dynamic>? ?? json['items'] as List<dynamic>? ?? [];
    return CategoryModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      sortOrder: parseInt(json['sortOrder'] ?? json['sort_order'], 0),
      products: productsRaw.map((e) => ProductModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class VendorCatalog {
  final String id;
  final String name;
  final String? logoUrl;
  final String? bannerUrl;
  final String addressText;
  final String? contactPhone;
  final double deliveryRadiusKm;
  final int estimatedPrepTimeMinutes;
  final bool isActive;
  /// The outlet's business type; a deactivated type hides the outlet from
  /// discovery and marks deep links unavailable (ADR-019).
  final String? typeName;
  final bool typeIsActive;
  final List<CategoryModel> categories;

  VendorCatalog({
    required this.id,
    required this.name,
    this.logoUrl,
    this.bannerUrl,
    required this.addressText,
    this.contactPhone,
    this.deliveryRadiusKm = 5.0,
    this.estimatedPrepTimeMinutes = 25,
    this.isActive = true,
    this.typeName,
    this.typeIsActive = true,
    this.categories = const [],
  });

  factory VendorCatalog.fromJson(Map<String, dynamic> json) {
    final categoriesRaw = json['categories'] as List<dynamic>? ?? [];
    return VendorCatalog(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      logoUrl: json['logoUrl'] as String? ?? json['logo_url'] as String?,
      bannerUrl: json['bannerUrl'] as String? ?? json['banner_url'] as String?,
      addressText: json['addressText'] as String? ?? json['address_text'] as String? ?? '',
      contactPhone: json['contactPhone'] as String? ?? json['contact_phone'] as String?,
      deliveryRadiusKm: parseDouble(json['deliveryRadiusKm'] ?? json['delivery_radius_km'], 5.0),
      estimatedPrepTimeMinutes: parseInt(json['estimatedPrepTimeMinutes'] ?? json['estimated_prep_time_minutes'], 25),
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
      typeName: (json['type'] as Map<String, dynamic>?)?['name'] as String?,
      typeIsActive: (json['type'] as Map<String, dynamic>?)?['isActive'] as bool? ?? true,
      categories: categoriesRaw.map((e) => CategoryModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
