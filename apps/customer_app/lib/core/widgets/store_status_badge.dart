import 'package:flutter/material.dart';
import '../constants/constants.dart';

class StoreStatusBadge extends StatelessWidget {
  final bool isOpen;
  final bool isBusy;
  final bool compact;

  const StoreStatusBadge({
    super.key,
    required this.isOpen,
    this.isBusy = false,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final String label;
    final Color bgColor;
    final Color textColor;

    if (!isOpen) {
      label = compact ? 'CLOSED' : 'STORE CLOSED';
      bgColor = AppColors.errorLight;
      textColor = AppColors.errorDark;
    } else if (isBusy) {
      label = 'BUSY';
      bgColor = AppColors.warningLight;
      textColor = AppColors.warningDark;
    } else {
      label = compact ? 'OPEN' : 'OPEN NOW';
      bgColor = AppColors.successLight;
      textColor = AppColors.successGreen;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6.0 : AppSpacing.sm,
        vertical: compact ? AppSpacing.xxs : AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: compact ? AppRadius.borderXs : AppRadius.borderSm,
      ),
      child: Text(
        label,
        style: (compact ? AppTypography.caption : AppTypography.labelSmall).copyWith(
          fontWeight: FontWeight.w800,
          color: textColor,
        ),
      ),
    );
  }
}
