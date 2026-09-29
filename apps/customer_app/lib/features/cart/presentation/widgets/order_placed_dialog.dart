import 'package:flutter/material.dart';
import '../../../../core/constants/constants.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../orders/presentation/payment_webview_screen.dart';

class OrderPlacedDialog extends StatelessWidget {
  final String orderId;
  final String orderNumber;
  final bool isOnline;
  final PaymentWebViewResult paymentResult;
  final Map<String, dynamic>? paymentSession;
  final VoidCallback onReturnHome;
  final VoidCallback onTrackOrder;

  const OrderPlacedDialog({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.isOnline,
    required this.paymentResult,
    required this.paymentSession,
    required this.onReturnHome,
    required this.onTrackOrder,
  });

  @override
  Widget build(BuildContext context) {
    final isPending = isOnline && paymentResult != PaymentWebViewResult.paid;

    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
      title: Row(
        children: [
          Icon(
            isPending
                ? Icons.schedule_rounded
                : isOnline
                    ? Icons.verified_rounded
                    : Icons.check_circle_rounded,
            color: isPending
                ? AppColors.warning
                : isOnline
                    ? AppColors.primary
                    : AppColors.secondary,
            size: 28,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              isPending
                  ? 'Order Placed — Payment Pending'
                  : isOnline
                      ? 'Payment Confirmed!'
                      : 'Order Confirmed!',
              style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Order $orderNumber has been placed successfully!',
            style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          if (isOnline) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: AppRadius.borderSm,
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Gateway:', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                      Text(paymentSession?['gateway']?.toString() ?? 'SANDBOX', style: AppTypography.labelMedium.copyWith(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Txn ID:', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                      Text(paymentSession?['transactionId']?.toString() ?? 'PENDING', style: AppTypography.labelSmall.copyWith(fontFamily: 'monospace')),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Amount:', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                      Text(
                        paymentSession?['amount'] != null
                            ? CurrencyFormatter.format(num.tryParse(paymentSession!['amount'].toString()) ?? 0)
                            : '',
                        style: AppTypography.titleSmall.copyWith(fontSize: 13, fontWeight: FontWeight.w900, color: AppColors.primary),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '⚡ Dispatch will activate immediately upon online payment verification confirmation.',
              style: AppTypography.caption.copyWith(fontStyle: FontStyle.italic),
            ),
          ] else ...[
            Text(
              'We have dispatched the order to the kitchen and courier fleet.',
              style: AppTypography.bodySmall,
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: onReturnHome,
          child: Text('Return to Home', style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary)),
        ),
        ElevatedButton.icon(
          onPressed: onTrackOrder,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.white,
            shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderSm),
          ),
          icon: const Icon(Icons.navigation_rounded, size: 16),
          label: Text(isOnline ? 'Go to Tracking' : 'Track Order', style: AppTypography.labelLarge.copyWith(color: AppColors.white)),
        ),
      ],
    );
  }
}
