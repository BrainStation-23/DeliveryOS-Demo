import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_typography.dart';

class PilotAccountsDebugCard extends StatelessWidget {
  final VoidCallback onSelectApproved;
  final VoidCallback onSelectPending;

  const PilotAccountsDebugCard({
    super.key,
    required this.onSelectApproved,
    required this.onSelectPending,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.dutyOnlineBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.dutyOnlineLight.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(
            '⚡ PILOT TEST ACCOUNTS (DEBUG ONLY)',
            style: AppTypography.badgeText.copyWith(color: AppColors.dutyOnline),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              ActionChip(
                avatar: const Icon(Icons.check_circle_rounded, color: AppColors.dutyOnline, size: 16),
                label: const Text('Approved Pilot (+8801700112233)'),
                onPressed: onSelectApproved,
              ),
              ActionChip(
                avatar: const Icon(Icons.pending_actions_rounded, color: AppColors.warning, size: 16),
                label: const Text('New / Pending (+8801700998877)'),
                onPressed: onSelectPending,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
