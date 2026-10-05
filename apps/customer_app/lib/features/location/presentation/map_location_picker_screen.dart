import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/constants/constants.dart';
import '../../../core/widgets/error_retry_view.dart';
import '../../../core/localization/app_localizations.dart';
import '../domain/user_location.dart';
import '../providers/location_provider.dart';
import '../../home/presentation/home_screen.dart';

class MapLocationPickerScreen extends ConsumerStatefulWidget {
  final bool isInitialOnboarding;

  const MapLocationPickerScreen({
    super.key,
    this.isInitialOnboarding = false,
  });

  @override
  ConsumerState<MapLocationPickerScreen> createState() =>
      _MapLocationPickerScreenState();
}

class _MapLocationPickerScreenState
    extends ConsumerState<MapLocationPickerScreen> {
  GoogleMapController? _mapController;
  late double _currentLat;
  late double _currentLng;
  late String _currentAddress;
  bool _mapInitFailed = false;
  late AddressType _selectedType;
  final TextEditingController _detailsController = TextEditingController();

  final List<Map<String, dynamic>> _neighborhoodPresets = [
    {
      'name': 'Banani (Road 11)',
      'lat': 23.7925,
      'lng': 90.4078,
      'address': 'House 42, Road 11, Banani, Dhaka',
    },
    {
      'name': 'Gulshan 1',
      'lat': 23.7780,
      'lng': 90.4180,
      'address': 'Gulshan 1 Circle, Avenue 1, Dhaka',
    },
    {
      'name': 'Dhanmondi',
      'lat': 23.7465,
      'lng': 90.3760,
      'address': 'Road 27, Dhanmondi, Dhaka',
    },
  ];

  @override
  void initState() {
    super.initState();
    final loc = ref.read(locationProvider).location;
    _currentLat = loc.latitude;
    _currentLng = loc.longitude;
    _currentAddress = loc.addressLine;
    _selectedType = loc.addressType;
    _detailsController.text = loc.buildingFloor ?? '';
  }

  @override
  void dispose() {
    _detailsController.dispose();
    _mapController?.dispose();
    super.dispose();
  }

  void _onPresetSelected(Map<String, dynamic> preset) {
    setState(() {
      _currentLat = preset['lat'] as double;
      _currentLng = preset['lng'] as double;
      _currentAddress = preset['address'] as String;
    });
    _animateCamera(_currentLat, _currentLng);
    ref.read(locationProvider.notifier).setCoordinates(
          _currentLat,
          _currentLng,
          customAddress: _currentAddress,
        );
  }

  void _animateCamera(double lat, double lng) {
    try {
      _mapController?.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: LatLng(lat, lng), zoom: 15.5),
        ),
      );
    } catch (_) {}
  }

  Future<void> _handleUseCurrentLocation() async {
    final success =
        await ref.read(locationProvider.notifier).useCurrentDeviceLocation();
    if (success && mounted) {
      final loc = ref.read(locationProvider).location;
      setState(() {
        _currentLat = loc.latitude;
        _currentLng = loc.longitude;
        _currentAddress = loc.addressLine;
      });
      _animateCamera(_currentLat, _currentLng);
    } else if (!success && mounted) {
      final err = ref.read(locationProvider).error ??
          'Could not determine current location';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _handleConfirm() async {
    final notifier = ref.read(locationProvider.notifier);
    await notifier.setCoordinates(
      _currentLat,
      _currentLng,
      customAddress: _currentAddress,
    );
    notifier.setAddressType(_selectedType);
    if (_detailsController.text.trim().isNotEmpty) {
      notifier.setAddressDetails(
        buildingFloor: _detailsController.text.trim(),
      );
    }

    if (!mounted) return;

    if (widget.isInitialOnboarding) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locState = ref.watch(locationProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0.5,
        leading: widget.isInitialOnboarding
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded,
                    color: AppColors.textPrimary, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
        title: Text(
          l10n.translate('location_title'),
          style: AppTypography.titleLarge.copyWith(
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            flex: 5,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _buildMapCanvas(),
                IgnorePointer(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        constraints: const BoxConstraints(maxWidth: 220),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.textPrimary,
                          borderRadius: AppRadius.borderXl,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.black.withValues(alpha: 0.2),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: Text(
                          _currentAddress.split(',').first,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(
                            color: AppColors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      const Icon(
                        Icons.location_on_rounded,
                        size: 44,
                        color: AppColors.primary,
                      ),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.black.withValues(alpha: 0.3),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
                Positioned(
                  bottom: AppSpacing.lg,
                  right: AppSpacing.lg,
                  child: FloatingActionButton.extended(
                    heroTag: 'fab_current_loc',
                    onPressed: _handleUseCurrentLocation,
                    backgroundColor: AppColors.white,
                    foregroundColor: AppColors.primary,
                    elevation: 3,
                    icon: const Icon(Icons.my_location_rounded, size: 18),
                    label: Text(
                      l10n.translate('current_location'),
                      style: AppTypography.labelMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          Container(
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.lg, AppSpacing.xl, AppSpacing.xxl),
            decoration: const BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(top: AppRadius.radiusXxl),
              boxShadow: [
                BoxShadow(
                  color: AppColors.black12,
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _neighborhoodPresets.map((preset) {
                          final isSelected =
                              (_currentAddress == preset['address']);
                          return Padding(
                            padding: const EdgeInsets.only(right: AppSpacing.sm),
                            child: ChoiceChip(
                              label: Text(preset['name'] as String),
                              selected: isSelected,
                              selectedColor:
                                  AppColors.primary.withValues(alpha: 0.15),
                              labelStyle: AppTypography.caption.copyWith(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                              backgroundColor: AppColors.background,
                              side: BorderSide(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                              onSelected: (_) => _onPresetSelected(preset),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.place_rounded,
                              color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _currentAddress,
                                style: AppTypography.titleSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                locState.isLoading
                                    ? l10n.translate('finding_nearby')
                                    : '${locState.nearbyStoreCount} ${l10n.translate('stores_found')}',
                                style: AppTypography.caption.copyWith(
                                  fontWeight: FontWeight.w500,
                                  color: locState.nearbyStoreCount > 0
                                      ? AppColors.secondary
                                      : AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        _buildTypeChip(
                          type: AddressType.home,
                          label: l10n.translate('home'),
                          icon: Icons.home_rounded,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _buildTypeChip(
                          type: AddressType.work,
                          label: l10n.translate('work'),
                          icon: Icons.work_rounded,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _buildTypeChip(
                          type: AddressType.other,
                          label: l10n.translate('other'),
                          icon: Icons.bookmark_rounded,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _detailsController,
                      decoration: InputDecoration(
                        hintText: l10n.translate('address_details_hint'),
                        hintStyle: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                        prefixIcon: const Icon(Icons.apartment_rounded,
                            size: 18, color: AppColors.textSecondary),
                        filled: true,
                        fillColor: AppColors.background,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: AppRadius.borderSm,
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: AppRadius.borderSm,
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _handleConfirm,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadius.borderMd,
                          ),
                        ),
                        child: Text(
                          l10n.translate('confirm_location'),
                          style: AppTypography.labelLarge.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapCanvas() {
    if (kIsWeb ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.linux ||
        defaultTargetPlatform == TargetPlatform.windows) {
      return _buildStyledMapPlaceholder();
    }

    if (_mapInitFailed) {
      return _buildMapErrorView();
    }

    try {
      return GoogleMap(
        initialCameraPosition: CameraPosition(
          target: LatLng(_currentLat, _currentLng),
          zoom: 15,
        ),
        onMapCreated: (ctrl) => _mapController = ctrl,
        onCameraIdle: () async {
          await ref.read(locationProvider.notifier).setCoordinates(
                _currentLat,
                _currentLng,
              );
          if (mounted) {
            setState(() {
              _currentAddress = ref.read(locationProvider).location.addressLine;
            });
          }
        },
        onCameraMove: (pos) {
          _currentLat = pos.target.latitude;
          _currentLng = pos.target.longitude;
        },
        myLocationEnabled: false,
        zoomControlsEnabled: false,
      );
    } catch (e) {
      // Surface the failure instead of silently faking a live map; the user
      // can retry initialization explicitly.
      _mapInitFailed = true;
      scheduleMicrotask(() {
        if (mounted) setState(() {});
      });
      return _buildStyledMapPlaceholder();
    }
  }

  Widget _buildMapErrorView() {
    final l10n = AppLocalizations.of(context);
    return ErrorRetryView(
      message: 'The map could not be loaded. Check your connection and try again.',
      onRetry: () => setState(() => _mapInitFailed = false),
      retryButtonText: l10n.translate('retry'),
    );
  }

  Widget _buildStyledMapPlaceholder() {
    return Container(
      color: AppColors.mapBackground,
      child: Stack(
        children: [
          CustomPaint(
            size: Size.infinite,
            painter: _MapGridPainter(),
          ),
          Positioned(
            top: AppSpacing.xl,
            left: AppSpacing.xl,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.9),
                borderRadius: AppRadius.borderSm,
                boxShadow: const [BoxShadow(color: AppColors.black12, blurRadius: 4)],
              ),
              child: Row(
                children: [
                  const Icon(Icons.explore_rounded,
                      size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    'Coordinates: (${_currentLat.toStringAsFixed(4)}, ${_currentLng.toStringAsFixed(4)})',
                    style: AppTypography.caption.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeChip({
    required AddressType type,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _selectedType == type;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedType = type),
        borderRadius: AppRadius.borderSm,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primary.withValues(alpha: 0.1)
                : AppColors.background,
            borderRadius: AppRadius.borderSm,
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? AppColors.primary : AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = AppColors.white
      ..strokeWidth = 5;

    final waterPaint = Paint()
      ..color = AppColors.mapWater
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(size.width * 0.8, 0)
      ..quadraticBezierTo(
        size.width * 0.7,
        size.height * 0.5,
        size.width * 0.9,
        size.height,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, waterPaint);

    canvas.drawLine(
      Offset(0, size.height * 0.4),
      Offset(size.width, size.height * 0.4),
      roadPaint,
    );
    canvas.drawLine(
      Offset(0, size.height * 0.65),
      Offset(size.width, size.height * 0.65),
      roadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.35, 0),
      Offset(size.width * 0.35, size.height),
      roadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.65, 0),
      Offset(size.width * 0.65, size.height),
      roadPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
