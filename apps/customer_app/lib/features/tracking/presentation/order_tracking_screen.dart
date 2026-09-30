import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/phone_call_launcher.dart';
import '../domain/tracking_models.dart';
import '../providers/tracking_provider.dart';
import 'widgets/order_stepper_widget.dart';
import 'widgets/payment_recovery_banner.dart';
import 'widgets/tracking_contact_card.dart';
import 'widgets/tracking_eta_banner.dart';
import 'widgets/tracking_map_view.dart';

class OrderTrackingScreen extends ConsumerWidget {
  final String orderId;
  final String? orderNumber;

  const OrderTrackingScreen({
    super.key,
    required this.orderId,
    this.orderNumber,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trackingState = ref.watch(trackingProvider(orderId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Live Order Tracking',
              style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
            ),
            Text(
              orderNumber ?? trackingState.orderNumber,
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.support_agent_rounded, size: 22, color: AppColors.primary),
            tooltip: '24/7 Support Hotline',
            onPressed: () => makeDirectPhoneCall('+8801700000000'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textPrimary),
            tooltip: 'Refresh Status',
            onPressed: () {
              ref.read(trackingProvider(orderId).notifier).refreshDetails();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 4,
            child: TrackingMapView(state: trackingState),
          ),
          Expanded(
            flex: 5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              decoration: const BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.vertical(top: AppRadius.radiusXl),
              ),
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  if (trackingState.paymentMethod == 'ONLINE_GATEWAY' &&
                      trackingState.paymentStatus != 'PAID' &&
                      !trackingState.isCancelled) ...[
                    PaymentRecoveryBanner(
                      onSwitchToCOD: () async {
                        final messenger = ScaffoldMessenger.of(context);
                        final success = await ref.read(trackingProvider(orderId).notifier).switchToCOD();
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Switched to Cash on Delivery! Order is now being dispatched.'),
                              backgroundColor: AppColors.secondary,
                            ),
                          );
                        }
                      },
                      onRefresh: () {
                        ref.read(trackingProvider(orderId).notifier).refreshDetails();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Checking gateway payment status...'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                  ],

                  TrackingEtaBanner(state: trackingState),
                  const SizedBox(height: AppSpacing.md),

                  if (trackingState.isCancelled &&
                      (trackingState.paymentStatus == 'REFUNDED' ||
                          trackingState.paymentMethod == 'ONLINE_GATEWAY' ||
                          trackingState.paymentMethod == 'ONLINE')) ...[
                    _buildRefundBanner(trackingState),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  OrderStepperWidget(currentStage: trackingState.stage),
                  const SizedBox(height: AppSpacing.md),

                  if (trackingState.rider != null && !trackingState.isCancelled) ...[
                    TrackingContactCard(
                      leading: CircleAvatar(
                        radius: 22,
                        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                        child: const Icon(Icons.person_rounded, color: AppColors.primary, size: 26),
                      ),
                      title: trackingState.rider!.name,
                      // Courier ratings are not a live data model yet — render
                      // the star row only when a real score exists.
                      titleTrailing: trackingState.rider!.rating != null
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star_rounded, color: AppColors.star, size: 14),
                                Text(
                                  trackingState.rider!.rating!.toString(),
                                  style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ],
                            )
                          : null,
                      subtitle: '${trackingState.rider!.vehicleType} • ${trackingState.rider!.phone}',
                      actionLabel: 'Call Rider',
                      isPrimaryAction: true,
                      onAction: () async {
                        final launched = await makeDirectPhoneCall(trackingState.rider!.phone);
                        if (!launched && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Calling ${trackingState.rider!.phone}...')),
                          );
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],

                  TrackingContactCard(
                    leading: Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: AppRadius.borderSm,
                      ),
                      child: const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 22),
                    ),
                    title: trackingState.store.name,
                    subtitle: trackingState.store.address,
                    actionLabel: 'Call Store',
                    isPrimaryAction: false,
                    onAction: () async {
                      final launched = await makeDirectPhoneCall(trackingState.store.phone);
                      if (!launched && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Calling store at ${trackingState.store.phone}...')),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  if (trackingState.canCancel) ...[
                    _buildCancelOrderButton(context, ref, trackingState),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRefundBanner(OrderTrackingState state) {
    final isRefunded = state.paymentStatus == 'REFUNDED';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.infoLight,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: AppColors.infoBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: const BoxDecoration(
              color: AppColors.infoBlue,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.currency_exchange_rounded, color: AppColors.white, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isRefunded ? 'Refund Processed' : 'Refund Pending',
                  style: AppTypography.titleSmall.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.infoDark,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  isRefunded
                      ? '${CurrencyFormatter.format(state.totalAmount)} has been refunded to your original payment method.'
                      : 'Your refund will be returned to your original payment method shortly.',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.infoText,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCancelOrderButton(
    BuildContext context,
    WidgetRef ref,
    OrderTrackingState state,
  ) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => _showCancelDialog(context, ref, state),
        icon: const Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
        label: Text(
          'Cancel Order',
          style: AppTypography.labelMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.error,
          ),
        ),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppColors.errorBorderLight),
          backgroundColor: AppColors.errorLight,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      ),
    );
  }

  void _showCancelDialog(
    BuildContext context,
    WidgetRef ref,
    OrderTrackingState state,
  ) {
    final reasonController = TextEditingController();
    String selectedPreset = 'Changed my mind';
    final presets = [
      'Changed my mind',
      'Ordered by mistake',
      'Delivery takes too long',
      'Wrong delivery address',
      'Other',
    ];

    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: AppColors.error),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Cancel Order?',
                style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Are you sure you want to cancel this order? You can cancel for free before the kitchen starts preparing your meal.',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
                if (state.paymentStatus == 'PAID' || state.paymentMethod == 'ONLINE') ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.infoLight,
                      borderRadius: AppRadius.borderSm,
                      border: Border.all(color: AppColors.infoBorder),
                    ),
                    child: Text(
                      'Your payment of ${CurrencyFormatter.format(state.totalAmount)} will be automatically refunded.',
                      style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600, color: AppColors.infoDark),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Reason for cancellation',
                  style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: presets.map((preset) {
                    final isSelected = selectedPreset == preset;
                    return ChoiceChip(
                      label: Text(preset),
                      selected: isSelected,
                      selectedColor: AppColors.primaryContainer,
                      labelStyle: AppTypography.caption.copyWith(
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? AppColors.primaryDark : AppColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) {
                          setDialogState(() {
                            selectedPreset = preset;
                            if (preset != 'Other') {
                              reasonController.text = preset;
                            } else {
                              reasonController.clear();
                            }
                          });
                        }
                      },
                    );
                  }).toList(),
                ),
                if (selectedPreset == 'Other') ...[
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: reasonController,
                    decoration: const InputDecoration(
                      hintText: 'Please specify reason...',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                    ),
                    maxLines: 2,
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: Text('Keep Order', style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () async {
                final reason = selectedPreset == 'Other'
                    ? (reasonController.text.trim().isEmpty ? 'Customer requested cancellation' : reasonController.text.trim())
                    : selectedPreset;
                Navigator.of(dialogCtx).pop();

                final success = await ref
                    .read(trackingProvider(orderId).notifier)
                    .cancelOrder(reason);

                if (context.mounted) {
                  if (success) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Order cancelled successfully.'),
                        backgroundColor: AppColors.successGreen,
                      ),
                    );
                  } else {
                    final err = ref.read(trackingProvider(orderId)).error ?? 'Could not cancel order.';
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(err),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: AppColors.white,
              ),
              child: const Text('Confirm Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}
