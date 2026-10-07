import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';

class AccountSuspendedCard extends StatelessWidget {
  final String? reason;
  final String? message;
  final VoidCallback? onDismiss;

  const AccountSuspendedCard({
    super.key,
    this.reason,
    this.message,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('account_suspended_banner'),
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.errorContainer,
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: AppColors.errorBorderLight,
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.error.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.block_rounded,
                  size: 20,
                  color: AppColors.error,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Account Suspended',
                      style: AppTypography.titleMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.errorText,
                      ),
                    ),
                    Text(
                      'Access restricted by administration',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.errorTextMedium,
                      ),
                    ),
                  ],
                ),
              ),
              if (onDismiss != null)
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.errorTextMedium),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: onDismiss,
                ),
            ],
          ),
          if (reason != null && reason!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm + 2),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: AppRadius.borderMd,
                border: Border.all(color: AppColors.errorBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: AppColors.errorTextMedium),
                      const SizedBox(width: 4),
                      Text(
                        'REASON FOR SUSPENSION',
                        style: AppTypography.labelSmall.copyWith(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppColors.errorText,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    reason!,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ] else if (message != null && message!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              message!,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.errorTextDark,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            'If you believe this is a mistake, please reach out to customer support at support@deliveryos.com.',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.errorText.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}
