import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../domain/search_result_model.dart';

class SearchItemCard extends StatelessWidget {
  final SearchItem item;
  final VoidCallback onAdd;

  const SearchItemCard({
    super.key,
    required this.item,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: AppSpacing.edgeInsetsMd,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: AppTypography.titleSmall.copyWith(
                          color: item.isInStock ? AppColors.textPrimary : AppColors.textMuted,
                        ),
                      ),
                    ),
                    if (!item.isInStock)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: const BoxDecoration(
                          color: AppColors.errorContainer,
                          borderRadius: AppRadius.borderXs,
                        ),
                        child: Text(
                          'Sold Out',
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.error,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  'from ${item.vendorDisplayName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelSmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                if (item.description != null && item.description!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    item.description!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.labelSmall.copyWith(
                      fontWeight: FontWeight.normal,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        CurrencyFormatter.formatWithUnit(item.basePrice, item.unitType),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.titleSmall.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: item.isInStock ? AppColors.textPrimary : AppColors.textMuted,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    ElevatedButton(
                      onPressed: item.isInStock ? onAdd : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryContainer,
                        foregroundColor: AppColors.primary,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: const RoundedRectangleBorder(
                          borderRadius: AppRadius.borderSm,
                          side: BorderSide(color: AppColors.primary),
                        ),
                        disabledBackgroundColor: AppColors.background,
                        disabledForegroundColor: AppColors.textMuted,
                      ),
                      child: Text(
                        item.isInStock ? 'ADD +' : 'UNAVAILABLE',
                        style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
