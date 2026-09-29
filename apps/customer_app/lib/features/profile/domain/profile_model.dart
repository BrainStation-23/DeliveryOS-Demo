class CustomerProfile {
  final String fullName;
  final String email;
  final String phone;
  final int totalOrders;
  final int totalAddresses;

  const CustomerProfile({
    this.fullName = '',
    this.email = '',
    this.phone = '',
    this.totalOrders = 0,
    this.totalAddresses = 0,
  });

  CustomerProfile copyWith({
    String? fullName,
    String? email,
    String? phone,
    int? totalOrders,
    int? totalAddresses,
  }) {
    return CustomerProfile(
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      totalOrders: totalOrders ?? this.totalOrders,
      totalAddresses: totalAddresses ?? this.totalAddresses,
    );
  }

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      fullName: json['fullName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      totalOrders: (json['totalOrders'] as num?)?.toInt() ?? 0,
      totalAddresses: (json['totalAddresses'] as num?)?.toInt() ?? 0,
    );
  }
}
