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
        color: const Color(0xFFFEF2F2),
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: const Color(0xFFFCA5A5),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withValues(alpha: 0.05),
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
                        color: const Color(0xFF991B1B),
                      ),
                    ),
                    Text(
                      'Access restricted by administration',
                      style: AppTypography.labelSmall.copyWith(
                        color: const Color(0xFFB91C1C),
                      ),
                    ),
                  ],
                ),
              ),
              if (onDismiss != null)
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFFB91C1C)),
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
                color: Colors.white,
                borderRadius: AppRadius.borderMd,
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFB91C1C)),
                      const SizedBox(width: 4),
                      Text(
                        'REASON FOR SUSPENSION',
                        style: AppTypography.labelSmall.copyWith(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: const Color(0xFF991B1B),
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
                color: const Color(0xFF7F1D1D),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            'If you believe this is a mistake, please reach out to customer support at support@deliveryos.com.',
            style: AppTypography.labelSmall.copyWith(
              color: const Color(0xFF991B1B).withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}
