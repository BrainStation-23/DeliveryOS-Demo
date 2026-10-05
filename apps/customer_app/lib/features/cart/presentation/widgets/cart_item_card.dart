import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../../core/widgets/quantity_stepper.dart';
import '../../domain/cart_item_model.dart';

class CartItemCard extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  const CartItemCard({
    super.key,
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
                Text(
                  item.product.name,
                  style: AppTypography.titleSmall,
                ),
                if (item.selectedVariant != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Portion: ${item.selectedVariant!.name}',
                    style: AppTypography.labelSmall.copyWith(color: AppColors.primary),
                  ),
                ],
                if (item.specialInstructions != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Note: "${item.specialInstructions}"',
                    style: AppTypography.caption.copyWith(fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  CurrencyFormatter.format(item.totalPrice),
                  style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
          QuantityStepper(
            quantity: item.quantity,
            minQuantity: 0,
            onIncrement: onIncrement,
            onDecrement: onDecrement,
          ),
        ],
      ),
    );
  }
}
