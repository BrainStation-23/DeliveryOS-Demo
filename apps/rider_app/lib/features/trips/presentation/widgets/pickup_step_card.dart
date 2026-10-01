import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../domain/trip_models.dart';

import 'trip_destination_card.dart';

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
    final bool isReadyForPickup = trip.status == 'READY_FOR_PICKUP';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TripDestinationCard(
          icon: Icons.storefront_rounded,
          iconColor: AppColors.primary,
          iconBackgroundColor: AppColors.primaryLight.withValues(alpha: 0.1),
          title: trip.store.name,
          address: trip.store.address,
          latitude: trip.store.latitude,
          longitude: trip.store.longitude,
          phoneNumber: trip.store.phone,
          directionsLabel: 'Directions to Store',
          callLabel: 'Call Store',
          noteText: trip.store.instructions,
        ),
        const SizedBox(height: AppSpacing.lg),
        if (isReadyForPickup)
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
          )
        else
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.warningBackground,
              borderRadius: AppRadius.roundedLg,
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.soup_kitchen_rounded, color: AppColors.warning, size: 28),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'KITCHEN PREPARING FOOD',
                        style: AppTypography.badgeText.copyWith(color: AppColors.warning),
                      ),
                      Text(
                        'Waiting for kitchen to mark ready',
                        style: AppTypography.h3.copyWith(fontWeight: FontWeight.w700, fontSize: 16),
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
            onPressed: (!isReadyForPickup || isUpdating) ? null : onConfirmPickup,
            style: ElevatedButton.styleFrom(
              backgroundColor: isReadyForPickup ? AppColors.dutyOnline : AppColors.grey400,
              foregroundColor: AppColors.white,
              disabledBackgroundColor: AppColors.grey300,
              disabledForegroundColor: AppColors.grey600,
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
                      Icon(
                        isReadyForPickup ? Icons.takeout_dining_rounded : Icons.hourglass_top_rounded,
                        size: 22,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          isReadyForPickup
                              ? 'ORDER PICKED UP ➔ START DELIVERY'
                              : 'ORDER PICKED UP (WAITING FOR KITCHEN)',
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
