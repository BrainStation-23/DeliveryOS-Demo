import 'package:flutter/material.dart';
import '../constants/constants.dart';

class SoldOutBadge extends StatelessWidget {
  final String label;

  const SoldOutBadge({
    super.key,
    this.label = 'Sold Out',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: const BoxDecoration(
        color: AppColors.errorContainer,
        borderRadius: AppRadius.borderXs,
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.error,
        ),
      ),
    );
  }
}
