import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_error_handler.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/profile_model.dart';

class ProfileState {
  final CustomerProfile profile;
  final bool isLoading;
  final String? error;

  const ProfileState({
    this.profile = const CustomerProfile(),
    this.isLoading = false,
    this.error,
  });

  ProfileState copyWith({
    CustomerProfile? profile,
    bool? isLoading,
    String? error,
  }) {
    return ProfileState(
      profile: profile ?? this.profile,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ProfileNotifier extends Notifier<ProfileState> {
  @override
  ProfileState build() {
    return const ProfileState();
  }

  Future<void> loadProfile() async {
    state = state.copyWith(isLoading: true, error: null);
    final auth = ref.read(authProvider);
    final fallbackPhone = auth.phoneNumber ?? auth.user?.phone ?? '';
    final fallbackName = auth.user?.fullName ?? 'Customer';

    try {
      final dio = ref.read(dioClientProvider);
      final res = await dio.get(ApiConstants.customerProfile);

      if (res.statusCode == 200) {
        final data = res.data['data'] as Map<String, dynamic>? ?? {};
        final loadedProfile = CustomerProfile.fromJson(data);
        state = state.copyWith(
          profile: loadedProfile.copyWith(
            fullName: loadedProfile.fullName.isNotEmpty ? loadedProfile.fullName : fallbackName,
            phone: loadedProfile.phone.isNotEmpty ? loadedProfile.phone : fallbackPhone,
          ),
          isLoading: false,
        );
        return;
      }
    } catch (e) {
      state = state.copyWith(
        error: ApiErrorHandler.parse(e),
        profile: state.profile.copyWith(
          fullName: fallbackName,
          phone: fallbackPhone,
        ),
        isLoading: false,
      );
      return;
    }

    state = state.copyWith(isLoading: false);
  }

  Future<bool> updateProfile({required String fullName, String? email}) async {
    try {
      final dio = ref.read(dioClientProvider);
      final res = await dio.patch(
        ApiConstants.customerProfile,
        data: {
          'fullName': fullName,
          if (email != null && email.isNotEmpty) 'email': email,
        },
      );

      if (res.statusCode == 200) {
        state = state.copyWith(
          profile: state.profile.copyWith(
            fullName: fullName,
            email: email ?? state.profile.email,
          ),
        );
        return true;
      }
    } catch (e) {
      state = state.copyWith(error: ApiErrorHandler.parse(e));
    }
    return false;
  }
}

final profileProvider = NotifierProvider<ProfileNotifier, ProfileState>(ProfileNotifier.new);
