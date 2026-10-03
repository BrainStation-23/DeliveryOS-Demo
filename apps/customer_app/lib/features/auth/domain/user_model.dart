class UserModel {
  final String id;
  final String phone;
  final String fullName;
  final String? email;
  final String role;

  UserModel({
    required this.id,
    required this.phone,
    required this.fullName,
    this.email,
    required this.role,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      fullName: json['fullName'] as String? ?? json['full_name'] as String? ?? 'Customer',
      email: json['email'] as String?,
      role: json['role'] as String? ?? 'CUSTOMER',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'fullName': fullName,
      'email': email,
      'role': role,
    };
  }
}

enum AuthStatus {
  initial,
  unauthenticated,
  otpSent,
  authenticated,
  guest,
  loading,
  error,
}

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? accessToken;
  final String? phoneNumber;
  final String? errorMessage;
  final bool isSuspended;
  final String? suspensionReason;

  AuthState({
    required this.status,
    this.user,
    this.accessToken,
    this.phoneNumber,
    this.errorMessage,
    this.isSuspended = false,
    this.suspensionReason,
  });

  factory AuthState.initial() => AuthState(status: AuthStatus.initial);

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? accessToken,
    String? phoneNumber,
    String? errorMessage,
    bool? isSuspended,
    String? suspensionReason,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      accessToken: accessToken ?? this.accessToken,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      errorMessage: errorMessage ?? this.errorMessage,
      isSuspended: isSuspended ?? this.isSuspended,
      suspensionReason: suspensionReason ?? this.suspensionReason,
    );
  }

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isGuest => status == AuthStatus.guest;
  bool get isLoading => status == AuthStatus.loading;
}
