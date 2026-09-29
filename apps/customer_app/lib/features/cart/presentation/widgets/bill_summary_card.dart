import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../domain/cart_item_model.dart';

class BillSummaryCard extends StatelessWidget {
  final CartState cart;

  const BillSummaryCard({
    super.key,
    required this.cart,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bill Summary',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          _SummaryRow(label: 'Item Subtotal', value: CurrencyFormatter.format(cart.grossSubtotal)),
          if (cart.couponDiscount > 0)
            _SummaryRow(
              label: 'Coupon Discount (${cart.couponCode})',
              value: CurrencyFormatter.formatDiscount(cart.couponDiscount),
              color: AppColors.secondary,
            ),
          _SummaryRow(
            label: 'Delivery Fee',
            value: cart.deliveryMethod == DeliveryMethod.takeaway ? 'FREE' : CurrencyFormatter.format(cart.deliveryFee),
          ),
          const Divider(height: 20, color: AppColors.border),
          _SummaryRow(
            label: 'Total Payable',
            value: CurrencyFormatter.format(cart.totalPayable),
            isBold: true,
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? color;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: (isBold ? AppTypography.titleSmall : AppTypography.bodySmall).copyWith(
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
                color: color ?? (isBold ? AppColors.textPrimary : AppColors.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            value,
            style: (isBold ? AppTypography.titleSmall : AppTypography.labelSmall).copyWith(
              fontSize: isBold ? 15 : 12,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: color ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
