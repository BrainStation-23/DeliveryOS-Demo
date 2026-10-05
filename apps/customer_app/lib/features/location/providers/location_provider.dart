import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/localization/language_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/nearby_vendor_model.dart';
import '../domain/outlet_type_model.dart';
import '../domain/user_location.dart';

class LocationState {
  final UserLocation location;
  final bool isLoading;
  final int nearbyStoreCount;
  final List<NearbyVendor> nearbyVendors;
  final List<OutletType> outletTypes;
  final String? error;

  LocationState({
    required this.location,
    this.isLoading = false,
    this.nearbyStoreCount = 0,
    this.nearbyVendors = const [],
    this.outletTypes = const [],
    this.error,
  });

  LocationState copyWith({
    UserLocation? location,
    bool? isLoading,
    int? nearbyStoreCount,
    List<NearbyVendor>? nearbyVendors,
    List<OutletType>? outletTypes,
    String? error,
  }) {
    return LocationState(
      location: location ?? this.location,
      isLoading: isLoading ?? this.isLoading,
      nearbyStoreCount: nearbyStoreCount ?? this.nearbyStoreCount,
      nearbyVendors: nearbyVendors ?? this.nearbyVendors,
      outletTypes: outletTypes ?? this.outletTypes,
      error: error,
    );
  }
}

class LocationNotifier extends Notifier<LocationState> {
  @override
  LocationState build() {
    final storage = ref.read(localStorageProvider);
    final saved = storage.getSavedLocation();
    if (saved != null) {
      final loc = UserLocation.fromJson(saved);
      Future.microtask(_bootstrapDiscovery);
      return LocationState(location: loc);
    }
    final initialLoc = UserLocation.defaultBanani();
    Future.microtask(_bootstrapDiscovery);
    return LocationState(location: initialLoc);
  }

  Future<void> setCoordinates(double lat, double lng, {String? customAddress}) async {
    state = state.copyWith(isLoading: true, error: null);
    final addressLine = customAddress ?? await reverseGeocode(lat, lng);
    final updated = state.location.copyWith(
      latitude: lat,
      longitude: lng,
      addressLine: addressLine,
    );

    state = state.copyWith(location: updated, isLoading: true);
    final storage = ref.read(localStorageProvider);
    await storage.setSavedLocation(updated.toJson());
    await fetchNearbyVendors(lat, lng);
  }

  Future<bool> useCurrentDeviceLocation() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = state.copyWith(isLoading: false, error: 'Location services are disabled.');
        return false;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          state = state.copyWith(isLoading: false, error: 'Location permissions are denied.');
          return false;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(isLoading: false, error: 'Location permissions are permanently denied.');
        return false;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      await setCoordinates(position.latitude, position.longitude);
      return true;
    } catch (_) {
      state = state.copyWith(isLoading: false, error: 'Failed to acquire device location.');
      return false;
    }
  }

  void setAddressType(AddressType type) {
    final updated = state.location.copyWith(addressType: type);
    state = state.copyWith(location: updated);
    ref.read(localStorageProvider).setSavedLocation(updated.toJson());
  }

  void setAddressDetails({String? buildingFloor, String? deliveryNote}) {
    final updated = state.location.copyWith(
      buildingFloor: buildingFloor,
      deliveryNote: deliveryNote,
    );
    state = state.copyWith(location: updated);
    ref.read(localStorageProvider).setSavedLocation(updated.toJson());
  }

  Future<void> _bootstrapDiscovery() async {
    await fetchOutletTypes();
    await fetchNearbyVendors(state.location.latitude, state.location.longitude);
  }

  /// Active outlet business types for the home category chips (public endpoint).
  Future<void> fetchOutletTypes() async {
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(ApiConstants.outletTypes);
      final data = response.data['data'];
      if (response.statusCode == 200 && data is List) {
        final types = data
            .whereType<Map<String, dynamic>>()
            .map(OutletType.fromJson)
            .toList();
        state = state.copyWith(outletTypes: types);
      }
    } catch (_) {
      // Chips stay hidden on failure; discovery itself is unaffected.
    }
  }

  Future<void> fetchNearbyVendors(double lat, double lng, {String? typeSlug}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(
        ApiConstants.nearbyVendors,
        queryParameters: {
          'lat': lat,
          'lng': lng,
          if (typeSlug != null && typeSlug.isNotEmpty) 'typeSlug': typeSlug,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        final vendors = data is List
            ? data
                .whereType<Map<String, dynamic>>()
                .map((e) => NearbyVendor.fromJson(e))
                .toList()
            : <NearbyVendor>[];
        state = state.copyWith(
          isLoading: false,
          nearbyStoreCount: vendors.length,
          nearbyVendors: vendors,
        );
        return;
      }
    } catch (_) {
      // Offline or network error
    }

    state = state.copyWith(
      isLoading: false,
      nearbyStoreCount: 0,
      nearbyVendors: [],
    );
  }

  Future<String> reverseGeocode(double lat, double lng) async {
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(
        ApiConstants.reverseGeocode,
        queryParameters: {'lat': lat, 'lng': lng},
      );
      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>? ?? {};
        final addr = data['addressLine'] as String? ?? data['displayName'] as String?;
        if (addr != null && addr.isNotEmpty) {
          return addr;
        }
      }
    } catch (_) {}
    return 'Lat: ${lat.toStringAsFixed(4)}, Lng: ${lng.toStringAsFixed(4)}';
  }

  Future<List<Map<String, dynamic>>> forwardGeocode(String query) async {
    final clean = query.trim();
    if (clean.isEmpty) return const [];
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(
        ApiConstants.forwardGeocode,
        queryParameters: {'q': clean},
      );
      if (response.statusCode == 200) {
        final payload = response.data['data'] as List<dynamic>? ?? [];
        return payload
            .whereType<Map>()
            .map((item) => item.cast<String, dynamic>())
            .toList();
      }
    } catch (_) {}
    return const [];
  }
}

final locationProvider =
    NotifierProvider<LocationNotifier, LocationState>(LocationNotifier.new);
