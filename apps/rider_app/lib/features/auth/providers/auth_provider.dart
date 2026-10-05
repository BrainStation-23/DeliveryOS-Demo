import 'dart:convert';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/local_storage.dart';
import '../domain/auth_models.dart';

class RiderAuthState {
  final bool isLoading;
  final bool isAuthenticated;
  final bool isPendingApproval;
  final String? phoneNumber;
  final String? registrationFullName;
  final VehicleType registrationVehicleType;
  final RiderProfileData? profile;
  final String? error;

  RiderAuthState({
    this.isLoading = false,
    this.isAuthenticated = false,
    this.isPendingApproval = false,
    this.phoneNumber,
    this.registrationFullName,
    this.registrationVehicleType = VehicleType.motorcycle,
    this.profile,
    this.error,
  });

  RiderAuthState copyWith({
    bool? isLoading,
    bool? isAuthenticated,
    bool? isPendingApproval,
    String? phoneNumber,
    String? registrationFullName,
    VehicleType? registrationVehicleType,
    RiderProfileData? profile,
    String? error,
    bool clearError = false,
  }) {
    return RiderAuthState(
      isLoading: isLoading ?? this.isLoading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isPendingApproval: isPendingApproval ?? this.isPendingApproval,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      registrationFullName: registrationFullName ?? this.registrationFullName,
      registrationVehicleType: registrationVehicleType ?? this.registrationVehicleType,
      profile: profile ?? this.profile,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class RiderAuthNotifier extends Notifier<RiderAuthState> {
  @override
  RiderAuthState build() {
    final sessionSub = sessionExpiredEventStream.stream.listen((message) {
      state = state.copyWith(
        isAuthenticated: false,
        error: message ?? 'Session expired. Please log in again.',
      );
    });
    ref.onDispose(() => sessionSub.cancel());

    final storage = ref.watch(localStorageProvider);
    final token = storage.getAccessToken();
    final profileJson = storage.getRiderProfileJson();

    if (token != null && profileJson != null) {
      try {
        final data = jsonDecode(profileJson) as Map<String, dynamic>;
        final profile = RiderProfileData.fromJson(data);
        if (profile.isApproved) {
          return RiderAuthState(
            isAuthenticated: true,
            isPendingApproval: false,
            profile: profile,
            phoneNumber: profile.phone,
          );
        } else {
          return RiderAuthState(
            isAuthenticated: false,
            isPendingApproval: true,
            profile: profile,
            phoneNumber: profile.phone,
          );
        }
      } catch (_) {
        // Corrupt storage fallback
      }
    }
    return RiderAuthState();
  }

  Future<bool> requestOtp({
    required String phone,
    String? fullName,
    VehicleType vehicleType = VehicleType.motorcycle,
  }) async {
    state = state.copyWith(
      isLoading: true,
      clearError: true,
      phoneNumber: phone,
      registrationFullName: fullName,
      registrationVehicleType: vehicleType,
    );

    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.requestOtp,
        data: {
          'phone': phone,
          'role': 'RIDER',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        state = state.copyWith(isLoading: false);
        return true;
      }
    } on DioException catch (dioErr) {
      final resData = dioErr.response?.data;
      final msg = resData is Map ? (resData['message'] ?? 'Failed to send OTP') : 'Failed to send OTP';
      state = state.copyWith(isLoading: false, error: msg.toString());
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Network error. Please try again.');
      return false;
    }

    state = state.copyWith(isLoading: false, error: 'Failed to send OTP');
    return false;
  }

  Future<bool> verifyOtp({required String otp}) async {
    final phone = state.phoneNumber;
    if (phone == null || phone.isEmpty) {
      state = state.copyWith(error: 'Phone number is missing.');
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.verifyOtp,
        data: {
          'phone': phone,
          'otp': otp,
          if (state.registrationFullName != null) 'fullName': state.registrationFullName,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data['data'] as Map<String, dynamic>? ?? {};
        final accessToken = data['accessToken'] as String? ?? '';
        final refreshToken = data['refreshToken'] as String? ?? '';

        final storage = ref.read(localStorageProvider);
        await storage.setAccessToken(accessToken);
        await storage.setRefreshToken(refreshToken);

        return await fetchProfile();
      }
    } on DioException catch (dioErr) {
      final statusCode = dioErr.response?.statusCode;
      final responseData = dioErr.response?.data;
      final message = responseData is Map ? (responseData['message'] ?? '') : '';

      // Check if server rejected due to PENDING_APPROVAL
      if (statusCode == 403 || message.toString().toLowerCase().contains('approval')) {
        final pendingProfile = RiderProfileData(
          id: '',
          userId: '',
          fullName: state.registrationFullName ?? 'Rider Applicant',
          phone: phone,
          vehicleType: state.registrationVehicleType,
          status: AccountStatus.pendingApproval,
          isOnline: false,
        );
        final storage = ref.read(localStorageProvider);
        await storage.setRiderProfileJson(jsonEncode(pendingProfile.toJson()));

        state = state.copyWith(
          isLoading: false,
          isAuthenticated: false,
          isPendingApproval: true,
          profile: pendingProfile,
        );
        return false;
      }

      state = state.copyWith(
        isLoading: false,
        error: message.isNotEmpty ? message.toString() : 'Invalid OTP code. Please try again.',
      );
      return false;
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        error: 'Unable to connect to server. Please check your network connection.',
      );
      return false;
    }

    state = state.copyWith(
      isLoading: false,
      error: 'Authentication failed. Please try again.',
    );
    return false;
  }

  Future<bool> fetchProfile() async {
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(ApiConstants.riderProfile);

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>? ?? {};
        final profile = RiderProfileData.fromJson(data);
        final storage = ref.read(localStorageProvider);
        await storage.setRiderProfileJson(jsonEncode(profile.toJson()));

        if (profile.isApproved) {
          state = state.copyWith(
            isLoading: false,
            isAuthenticated: true,
            isPendingApproval: false,
            profile: profile,
          );
          return true;
        } else {
          state = state.copyWith(
            isLoading: false,
            isAuthenticated: false,
            isPendingApproval: true,
            profile: profile,
          );
          return false;
        }
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to retrieve rider profile.',
      );
      return false;
    }

    return false;
  }

  Future<void> refreshApprovalStatus() async {
    state = state.copyWith(isLoading: true, clearError: true);
    await Future.delayed(const Duration(milliseconds: 600));

    final success = await fetchProfile();
    if (!success && state.isPendingApproval) {
      state = state.copyWith(
        isLoading: false,
        error: 'Your application is still under review by the administrator.',
      );
    }
  }

  void forceApproveForDev() {
    if (kDebugMode && state.profile != null) {
      final approved = state.profile!.copyWith(status: AccountStatus.active);
      final storage = ref.read(localStorageProvider);
      storage.setRiderProfileJson(jsonEncode(approved.toJson()));
      state = state.copyWith(
        isAuthenticated: true,
        isPendingApproval: false,
        profile: approved,
      );
    }
  }

  Future<void> logout() async {
    final storage = ref.read(localStorageProvider);
    final refreshToken = storage.getRefreshToken();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      try {
        final dio = ref.read(dioClientProvider);
        await dio.post(
          ApiConstants.logout,
          data: {'refreshToken': refreshToken},
        );
      } catch (_) {
        // Fire-and-forget server token revocation: proceed with local session purge
      }
    }
    await storage.clearAuth();
    state = RiderAuthState();
  }
}

final riderAuthProvider = NotifierProvider<RiderAuthNotifier, RiderAuthState>(
  RiderAuthNotifier.new,
);
