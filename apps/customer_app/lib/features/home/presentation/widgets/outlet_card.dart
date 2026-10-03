import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../../core/widgets/store_status_badge.dart';
import '../../../location/domain/nearby_vendor_model.dart';
import '../../../store/presentation/outlet_detail_screen.dart';

class OutletCard extends StatelessWidget {
  final NearbyVendor vendor;

  const OutletCard({
    super.key,
    required this.vendor,
  });

  @override
  Widget build(BuildContext context) {
    final vDeliveryTime = '${vendor.defaultPrepTimeMinutes} min';
    final vDistance = '${vendor.distanceKm.toStringAsFixed(1)} km';

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => OutletDetailScreen(
              vendorId: vendor.id,
              initialVendorName: vendor.displayName,
            ),
          ),
        );
      },
      borderRadius: AppRadius.borderLg,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: AppColors.black12,
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: AppSpacing.edgeInsetsMd,
          child: Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: AppRadius.borderSm,
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vendor.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.titleSmall.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      vendor.addressText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodySmall,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.place_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 2),
                            Text(
                              vDistance,
                              style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.timer_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              vDeliveryTime,
                              style: AppTypography.labelSmall.copyWith(
                                fontWeight: FontWeight.normal,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        StoreStatusBadge(
                          isOpen: vendor.isActive,
                          isBusy: vendor.isBusy,
                          compact: true,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
