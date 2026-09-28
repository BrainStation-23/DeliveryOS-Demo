import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../../../core/utils/native_launcher.dart';
import '../../domain/trip_models.dart';

class PickupStepCard extends StatelessWidget {
  final TripOrder trip;
  final bool isUpdating;
  final Future<void> Function() onConfirmPickup;

  const PickupStepCard({
    super.key,
    required this.trip,
    required this.isUpdating,
    required this.onConfirmPickup,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withValues(alpha: 0.1),
                      borderRadius: AppRadius.roundedMd,
                    ),
                    child: const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 26),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trip.store.name,
                          style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          trip.store.address,
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => openNativeTurnByTurnNavigation(trip.store.latitude, trip.store.longitude),
                      icon: const Icon(Icons.navigation_rounded, size: 18),
                      label: Text(
                        'Directions to Store',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.buttonText.copyWith(fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                        shape: const RoundedRectangleBorder(borderRadius: AppRadius.roundedMd),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton.icon(
                    onPressed: trip.store.phone.isEmpty ? null : () => makeDirectPhoneCall(trip.store.phone),
                    icon: const Icon(Icons.phone_rounded, size: 18),
                    label: Text(
                      'Call Store',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.buttonText.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.borderStrong),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: AppSpacing.md),
                      shape: const RoundedRectangleBorder(borderRadius: AppRadius.roundedMd),
                    ),
                  ),
                ],
              ),
              if (trip.store.instructions != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: AppRadius.roundedMd,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 18, color: AppColors.textSecondary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          trip.store.instructions!,
                          style: AppTypography.caption,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.dutyOnlineBackground,
            borderRadius: AppRadius.roundedLg,
            border: Border.all(color: AppColors.dutyOnline.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.inventory_2_rounded, color: AppColors.dutyOnline, size: 28),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'LOOK FOR PACKAGE BAG',
                      style: AppTypography.badgeText.copyWith(color: AppColors.dutyOnline),
                    ),
                    Text(
                      'Order ${trip.orderNumber}',
                      style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
        SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: isUpdating ? null : onConfirmPickup,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.dutyOnline,
              foregroundColor: AppColors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: isUpdating
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2.5),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.takeout_dining_rounded, size: 22),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          'ORDER PICKED UP ➔ START DELIVERY',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.buttonText.copyWith(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 0.3),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
