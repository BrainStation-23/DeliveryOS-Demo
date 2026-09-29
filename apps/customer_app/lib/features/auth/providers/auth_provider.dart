import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/localization/language_provider.dart';
import '../domain/user_model.dart';

final dioClientProvider = Provider<DioClient>((ref) {
  final storage = ref.watch(localStorageProvider);
  return DioClient(storage: storage);
});

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    return AuthState.initial();
  }

  Future<void> checkSession() async {
    final storage = ref.read(localStorageProvider);
    final token = storage.getAccessToken();
    final cachedUser = storage.getUserProfile();
    final isGuest = storage.isGuest();

    if (token != null && cachedUser != null) {
      state = AuthState(
        status: AuthStatus.authenticated,
        accessToken: token,
        user: UserModel.fromJson(cachedUser),
      );
    } else if (isGuest) {
      state = AuthState(status: AuthStatus.guest);
    } else {
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> sendOtp(String phone) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.sendOtp,
        data: {'phone': phone},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        state = state.copyWith(
          status: AuthStatus.otpSent,
          phoneNumber: phone,
        );
        return true;
      }
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Failed to send OTP code',
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Could not send the OTP code. Please check your connection and try again.',
      );
      return false;
    }
  }

  Future<bool> verifyOtp(String phone, String otp) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    final storage = ref.read(localStorageProvider);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        ApiConstants.verifyOtp,
        data: {
          'phone': phone,
          'otp': otp,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data['data'] as Map<String, dynamic>;
        final token = data['accessToken'] as String? ?? '';
        final refreshToken = data['refreshToken'] as String?;
        final userMap = data['user'] as Map<String, dynamic>? ?? {};

        await storage.setAccessToken(token);
        // Without the persisted refresh token the 401-rotation path in
        // DioClient can never run and every access-token expiry logs the user out.
        if (refreshToken != null && refreshToken.isNotEmpty) {
          await storage.setRefreshToken(refreshToken);
        }
        await storage.setUserProfile(userMap);
        await storage.setGuest(false);

        state = AuthState(
          status: AuthStatus.authenticated,
          accessToken: token,
          user: UserModel.fromJson(userMap),
          phoneNumber: phone,
        );
        return true;
      }

      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Invalid OTP code',
      );
      return false;
    } on DioException catch (dioErr) {
      final resData = dioErr.response?.data;
      final msg = resData is Map ? (resData['message'] ?? 'Invalid OTP code') : 'Invalid OTP code';
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: msg.toString(),
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Verification failed. Please check your connection.',
      );
      return false;
    }
  }

  Future<void> continueAsGuest() async {
    final storage = ref.read(localStorageProvider);
    await storage.setGuest(true);
    state = AuthState(status: AuthStatus.guest);
  }

  Future<void> logout() async {
    final storage = ref.read(localStorageProvider);
    await storage.clearSession();
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider =
    NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
