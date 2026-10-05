/// Active outlet business type powering the home category chips (ADR-019).
class OutletType {
  final String id;
  final String name;
  final String slug;
  final int sortOrder;

  const OutletType({
    required this.id,
    required this.name,
    required this.slug,
    this.sortOrder = 0,
  });

  factory OutletType.fromJson(Map<String, dynamic> json) {
    return OutletType(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }
}
