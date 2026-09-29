import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_typography.dart';

class AuthTabToggle extends StatelessWidget {
  final bool isRegistering;
  final ValueChanged<bool> onTabChanged;

  const AuthTabToggle({
    super.key,
    required this.isRegistering,
    required this.onTabChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => onTabChanged(false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: BoxDecoration(
                  color: !isRegistering ? AppColors.primary : AppColors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Rider Login',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyBold.copyWith(
                    fontWeight: FontWeight.w800,
                    color: !isRegistering ? AppColors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => onTabChanged(true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: BoxDecoration(
                  color: isRegistering ? AppColors.primary : AppColors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Apply / Register',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyBold.copyWith(
                    fontWeight: FontWeight.w800,
                    color: isRegistering ? AppColors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
