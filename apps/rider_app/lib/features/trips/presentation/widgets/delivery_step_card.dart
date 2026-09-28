import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../../../core/utils/native_launcher.dart';
import '../../domain/trip_models.dart';

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
                    decoration: const BoxDecoration(
                      color: AppColors.dutyOnlineBackground,
                      borderRadius: AppRadius.roundedMd,
                    ),
                    child: const Icon(Icons.person_pin_circle_rounded, color: AppColors.dutyOnline, size: 28),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trip.customer.name,
                          style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          trip.customer.address,
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
                      onPressed: () => openNativeTurnByTurnNavigation(trip.customer.latitude, trip.customer.longitude),
                      icon: const Icon(Icons.navigation_rounded, size: 18),
                      label: Text(
                        'Directions to Customer',
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
                    onPressed: trip.customer.phone.isEmpty ? null : () => makeDirectPhoneCall(trip.customer.phone),
                    icon: const Icon(Icons.phone_rounded, size: 18),
                    label: Text(
                      'Call Customer',
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
              if (trip.customer.deliveryNotes != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.warningBackground,
                    borderRadius: AppRadius.roundedMd,
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.notes_rounded, size: 18, color: AppColors.warning),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Note: ${trip.customer.deliveryNotes!}',
                          style: AppTypography.caption.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
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
