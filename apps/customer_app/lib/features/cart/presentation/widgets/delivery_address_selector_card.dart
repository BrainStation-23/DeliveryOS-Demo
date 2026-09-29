import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../addresses/domain/address_model.dart';

class DeliveryAddressSelectorCard extends StatelessWidget {
  final CustomerAddressModel? selectedAddress;
  final String fallbackAddressLine;
  final VoidCallback onChangePressed;

  const DeliveryAddressSelectorCard({
    super.key,
    required this.selectedAddress,
    required this.fallbackAddressLine,
    required this.onChangePressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppSpacing.edgeInsetsMd,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Icon(
                      selectedAddress != null
                          ? (selectedAddress!.label.toLowerCase() == 'home'
                              ? Icons.home_rounded
                              : (selectedAddress!.label.toLowerCase() == 'work'
                                  ? Icons.work_rounded
                                  : Icons.location_on_rounded))
                          : Icons.my_location_rounded,
                      color: AppColors.primary,
                      size: 18,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(
                        selectedAddress != null
                            ? 'Deliver to: ${selectedAddress!.label}'
                            : 'Deliver to Current Location',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.titleSmall.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              TextButton(
                onPressed: onChangePressed,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Change',
                  style: AppTypography.labelMedium.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            selectedAddress?.addressLine ?? fallbackAddressLine,
            style: AppTypography.bodySmall,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
