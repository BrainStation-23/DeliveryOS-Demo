import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/banner_model.dart';

class BannerState {
  final List<BannerModel> banners;
  final bool isLoading;
  final String? error;

  BannerState({
    this.banners = const [],
    this.isLoading = false,
    this.error,
  });

  BannerState copyWith({
    List<BannerModel>? banners,
    bool? isLoading,
    String? error,
  }) {
    return BannerState(
      banners: banners ?? this.banners,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class BannerNotifier extends Notifier<BannerState> {
  @override
  BannerState build() {
    Future.microtask(() => fetchBanners());
    return BannerState(banners: const [], isLoading: true);
  }

  Future<void> fetchBanners({double? lat, double? lng}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio = ref.read(dioClientProvider);
      final queryParams = <String, dynamic>{};
      if (lat != null && lng != null) {
        queryParams['lat'] = lat;
        queryParams['lng'] = lng;
      }
      final response = await dio.get(
        ApiConstants.activeBanners,
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>? ?? [];
        final banners = data
            .whereType<Map<String, dynamic>>()
            .map((json) => BannerModel.fromJson(json))
            .toList();
        state = state.copyWith(banners: banners, isLoading: false);
        return;
      }
    } catch (e) {
      state = state.copyWith(
        banners: const [],
        isLoading: false,
        error: 'Failed to load promotional banners',
      );
      return;
    }
    state = state.copyWith(banners: const [], isLoading: false);
  }
}

final bannerProvider =
    NotifierProvider<BannerNotifier, BannerState>(BannerNotifier.new);
