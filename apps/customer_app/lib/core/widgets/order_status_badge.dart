import 'package:flutter/material.dart';
import '../constants/constants.dart';

class OrderStatusBadge extends StatelessWidget {
  final String status;

  const OrderStatusBadge({
    super.key,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status;

    switch (status.toUpperCase()) {
      case 'DISPATCHED':
      case 'RIDER_ASSIGNED':
        bg = AppColors.primaryContainer;
        fg = AppColors.primaryDark;
        label = 'OUT FOR DELIVERY';
        break;
      case 'PREPARING':
      case 'ACCEPTED':
        bg = AppColors.warningLight;
        fg = AppColors.warningTextDark;
        label = 'PREPARING';
        break;
      case 'DELIVERED':
        bg = AppColors.successContainer;
        fg = AppColors.successDark;
        label = 'DELIVERED';
        break;
      case 'CANCELLED':
        bg = AppColors.errorContainer;
        fg = AppColors.errorDark;
        label = 'CANCELLED';
        break;
      default:
        bg = AppColors.background;
        fg = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.borderXs),
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.15,
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.caption.copyWith(
            fontWeight: FontWeight.w800,
            color: fg,
          ),
        ),
      ),
    );
  }
}
