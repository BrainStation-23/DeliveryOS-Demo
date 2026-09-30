import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../location/presentation/map_location_picker_screen.dart';
import '../../location/providers/location_provider.dart';
import '../domain/address_model.dart';
import '../providers/address_provider.dart';

class AddressBookScreen extends ConsumerStatefulWidget {
  final bool isSelectionMode;

  const AddressBookScreen({
    super.key,
    this.isSelectionMode = false,
  });

  @override
  ConsumerState<AddressBookScreen> createState() => _AddressBookScreenState();
}

class _AddressBookScreenState extends ConsumerState<AddressBookScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(addressProvider.notifier).loadAddresses();
    });
  }

  void _showAddEditAddressSheet({CustomerAddressModel? existingAddress}) {
    final labelOptions = ['Home', 'Work', 'Other'];
    String selectedLabel = existingAddress?.label ?? 'Home';
    final addressLineController = TextEditingController(text: existingAddress?.addressLine ?? '');
    final buildingFloorController = TextEditingController(text: existingAddress?.buildingFloor ?? '');
    final deliveryNoteController = TextEditingController(text: existingAddress?.deliveryNote ?? '');
    bool isDefault = existingAddress?.isDefault ?? false;

    final currentLoc = ref.read(locationProvider).location;
    double? customLat;
    double? customLng;
    final lat = existingAddress?.latitude ?? currentLoc.latitude;
    final lng = existingAddress?.longitude ?? currentLoc.longitude;

    if (existingAddress == null && addressLineController.text.isEmpty) {
      addressLineController.text = currentLoc.addressLine;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: AppRadius.radiusXl),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.xl,
            left: AppSpacing.xl,
            right: AppSpacing.xl,
            top: AppSpacing.xl,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        existingAddress != null ? 'Edit Address' : 'Add New Address',
                        style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Address Label', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: AppSpacing.sm),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: labelOptions.map((l) {
                      final isSelected = selectedLabel == l;
                      return Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.sm),
                        child: ChoiceChip(
                          label: Text(l),
                          selected: isSelected,
                          selectedColor: AppColors.primary.withValues(alpha: 0.15),
                          labelStyle: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.w700,
                            color: isSelected ? AppColors.primary : AppColors.textSecondary,
                          ),
                          onSelected: (_) {
                            setSheetState(() => selectedLabel = l);
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Street Address & Area', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                TextField(
                  controller: addressLineController,
                  decoration: InputDecoration(
                    hintText: 'e.g. House 42, Road 11, Banani, Dhaka',
                    hintStyle: AppTypography.caption.copyWith(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                  ),
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerRight,
                  child: InkWell(
                    onTap: () async {
                      await Navigator.push(
                        ctx,
                        MaterialPageRoute(
                          builder: (_) => const MapLocationPickerScreen(),
                        ),
                      );
                      final updatedLoc = ref.read(locationProvider).location;
                      setSheetState(() {
                        customLat = updatedLoc.latitude;
                        customLng = updatedLoc.longitude;
                        addressLineController.text = updatedLoc.addressLine;
                      });
                    },
                    borderRadius: AppRadius.borderSm,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.map_rounded, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            'Pick Location on Map',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Apartment / Building / Floor (Optional)', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                TextField(
                  controller: buildingFloorController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Apt 4B, 4th Floor',
                    hintStyle: AppTypography.caption.copyWith(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Delivery Instructions (Optional)', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                TextField(
                  controller: deliveryNoteController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Call when outside, leave with security...',
                    hintStyle: AppTypography.caption.copyWith(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Set as default delivery address', style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600)),
                  value: isDefault,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    setSheetState(() => isDefault = val ?? false);
                  },
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final line = addressLineController.text.trim();
                      if (line.isEmpty) return;

                      double resolvedLat = customLat ?? (existingAddress?.latitude ?? lat);
                      double resolvedLng = customLng ?? (existingAddress?.longitude ?? lng);

                      if (customLat == null && existingAddress == null) {
                        try {
                          final matches = await ref.read(locationProvider.notifier).forwardGeocode(line);
                          if (matches.isNotEmpty) {
                            final first = matches.first;
                            final fLat = (first['latitude'] as num?)?.toDouble();
                            final fLng = (first['longitude'] as num?)?.toDouble();
                            if (fLat != null && fLng != null) {
                              resolvedLat = fLat;
                              resolvedLng = fLng;
                            }
                          }
                        } catch (_) {}
                      }

                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);
                      if (existingAddress != null) {
                        await ref.read(addressProvider.notifier).updateAddress(
                              addressId: existingAddress.id,
                              label: selectedLabel,
                              addressLine: line,
                              buildingFloor: buildingFloorController.text.trim(),
                              deliveryNote: deliveryNoteController.text.trim(),
                              latitude: resolvedLat,
                              longitude: resolvedLng,
                              isDefault: isDefault,
                            );
                      } else {
                        await ref.read(addressProvider.notifier).createAddress(
                              label: selectedLabel,
                              addressLine: line,
                              buildingFloor: buildingFloorController.text.trim(),
                              deliveryNote: deliveryNoteController.text.trim(),
                              latitude: resolvedLat,
                              longitude: resolvedLng,
                              isDefault: isDefault,
                            );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
                    ),
                    child: Text(existingAddress != null ? 'Update Address' : 'Save Address', style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final addressState = ref.watch(addressProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          widget.isSelectionMode ? 'Select Delivery Address' : 'Saved Addresses',
          style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800),
        ),
        elevation: 0,
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_location_alt_rounded, color: AppColors.primary),
            tooltip: 'Add Address',
            onPressed: () => _showAddEditAddressSheet(),
          ),
        ],
      ),
      body: addressState.isLoading && addressState.addresses.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : addressState.addresses.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xxxl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.location_off_rounded, size: 48, color: AppColors.primary),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Text(
                          'No Saved Addresses',
                          style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Add your delivery locations for fast single-tap checkout.',
                          textAlign: TextAlign.center,
                          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        ElevatedButton.icon(
                          onPressed: () => _showAddEditAddressSheet(),
                          icon: const Icon(Icons.add),
                          label: const Text('Add First Address'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.white,
                            shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: addressState.addresses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final address = addressState.addresses[index];
                    final isSelected = addressState.selectedAddress?.id == address.id;

                    return InkWell(
                      onTap: () {
                        ref.read(addressProvider.notifier).selectAddress(address);
                        if (widget.isSelectionMode) {
                          Navigator.pop(context, address);
                        }
                      },
                      borderRadius: AppRadius.borderLg,
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: AppRadius.borderLg,
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.border,
                            width: isSelected ? 1.8 : 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.black.withValues(alpha: 0.03),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  address.label == 'Home'
                                      ? Icons.home_rounded
                                      : address.label == 'Work'
                                          ? Icons.business_rounded
                                          : Icons.place_rounded,
                                  size: 18,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Flexible(
                                  child: Text(
                                    address.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                                  ),
                                ),
                                if (address.isDefault) ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.secondary.withValues(alpha: 0.15),
                                      borderRadius: AppRadius.borderSm,
                                    ),
                                    child: Text(
                                      'DEFAULT',
                                      style: AppTypography.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.secondary),
                                    ),
                                  ),
                                ],
                                const Spacer(),
                                PopupMenuButton<String>(
                                  icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textSecondary),
                                  onSelected: (val) {
                                    if (val == 'default') {
                                      ref.read(addressProvider.notifier).setDefaultAddress(address.id);
                                    } else if (val == 'edit') {
                                      _showAddEditAddressSheet(existingAddress: address);
                                    } else if (val == 'delete') {
                                      ref.read(addressProvider.notifier).deleteAddress(address.id);
                                    }
                                  },
                                  itemBuilder: (_) => [
                                    if (!address.isDefault)
                                      const PopupMenuItem(value: 'default', child: Text('Set as Default')),
                                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                    PopupMenuItem(value: 'delete', child: Text('Delete', style: AppTypography.bodyMedium.copyWith(color: AppColors.error))),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              address.addressLine,
                              style: AppTypography.bodySmall.copyWith(color: AppColors.textPrimary),
                            ),
                            if (address.buildingFloor != null && address.buildingFloor!.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                address.buildingFloor!,
                                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                            if (address.deliveryNote != null && address.deliveryNote!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.info_outline_rounded, size: 12, color: AppColors.textMuted),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      address.deliveryNote!,
                                      style: AppTypography.caption.copyWith(fontStyle: FontStyle.italic, color: AppColors.textMuted),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
