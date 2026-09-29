import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../../../core/utils/native_launcher.dart';

class TripDestinationCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBackgroundColor;
  final String title;
  final String address;
  final double latitude;
  final double longitude;
  final String phoneNumber;
  final String directionsLabel;
  final String callLabel;
  final String? noteText;
  final IconData noteIcon;
  final Color? noteBackgroundColor;
  final Color? noteBorderColor;

  const TripDestinationCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.iconBackgroundColor,
    required this.title,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.phoneNumber,
    required this.directionsLabel,
    required this.callLabel,
    this.noteText,
    this.noteIcon = Icons.info_outline_rounded,
    this.noteBackgroundColor,
    this.noteBorderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  color: iconBackgroundColor,
                  borderRadius: AppRadius.roundedMd,
                ),
                child: Icon(icon, color: iconColor, size: 26),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      address,
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
                  onPressed: () => openNativeTurnByTurnNavigation(latitude, longitude),
                  icon: const Icon(Icons.navigation_rounded, size: 18),
                  label: Text(
                    directionsLabel,
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
                onPressed: phoneNumber.isEmpty ? null : () => makeDirectPhoneCall(phoneNumber),
                icon: const Icon(Icons.phone_rounded, size: 18),
                label: Text(
                  callLabel,
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
          if (noteText != null && noteText!.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: noteBackgroundColor ?? AppColors.background,
                borderRadius: AppRadius.roundedMd,
                border: Border.all(color: noteBorderColor ?? AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(noteIcon, size: 18, color: noteBorderColor ?? AppColors.textSecondary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      noteText!,
                      style: AppTypography.caption.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
