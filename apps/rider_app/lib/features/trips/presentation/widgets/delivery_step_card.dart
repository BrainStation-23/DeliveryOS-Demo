import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../domain/trip_models.dart';

import 'trip_destination_card.dart';

class DeliveryStepCard extends StatelessWidget {
  final TripOrder trip;
  final VoidCallback onProceedToHandover;
  final VoidCallback onReportUnreachable;

  const DeliveryStepCard({
    super.key,
    required this.trip,
    required this.onProceedToHandover,
    required this.onReportUnreachable,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TripDestinationCard(
          icon: Icons.person_pin_circle_rounded,
          iconColor: AppColors.dutyOnline,
          iconBackgroundColor: AppColors.dutyOnlineBackground,
          title: trip.customer.name,
          address: trip.customer.address,
          latitude: trip.customer.latitude,
          longitude: trip.customer.longitude,
          phoneNumber: trip.customer.phone,
          directionsLabel: 'Directions to Customer',
          callLabel: 'Call Customer',
          noteText: trip.customer.deliveryNotes != null ? 'Note: ${trip.customer.deliveryNotes}' : null,
          noteIcon: Icons.notes_rounded,
          noteBackgroundColor: AppColors.warningBackground,
          noteBorderColor: AppColors.warning.withValues(alpha: 0.3),
        ),
        const SizedBox(height: AppSpacing.xxl),
        SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: onProceedToHandover,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.dutyOnline,
              foregroundColor: AppColors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.door_front_door_rounded, size: 22),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text(
                    'ARRIVED AT DOORSTEP ➔ HANDOVER',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.buttonText.copyWith(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 0.3),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: onReportUnreachable,
          icon: const Icon(Icons.person_off_rounded, size: 18, color: AppColors.error),
          label: const Text(
            'Customer Unreachable at Doorstep?',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.error,
            side: BorderSide(color: AppColors.error.withValues(alpha: 0.5)),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
            shape: const RoundedRectangleBorder(borderRadius: AppRadius.roundedMd),
          ),
        ),
      ],
    );
  }
}
