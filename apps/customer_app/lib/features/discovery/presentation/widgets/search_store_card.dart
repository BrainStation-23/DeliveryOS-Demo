import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../domain/search_result_model.dart';

class SearchStoreCard extends StatelessWidget {
  final SearchOutlet outlet;
  final VoidCallback onTap;

  const SearchStoreCard({
    super.key,
    required this.outlet,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.borderMd,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: AppSpacing.edgeInsetsMd,
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: AppColors.primaryContainer,
                borderRadius: AppRadius.borderSm,
              ),
              child: const Icon(
                Icons.storefront_rounded,
                color: AppColors.primary,
                size: 22,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    outlet.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.titleSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    outlet.addressText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.labelSmall.copyWith(
                      fontWeight: FontWeight.normal,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: AppRadius.borderSm,
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                '${outlet.distanceKm.toStringAsFixed(1)} km',
                style: AppTypography.labelSmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
