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
