import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../tracking/presentation/order_tracking_screen.dart';
import '../domain/order_history_model.dart';
import '../providers/order_history_provider.dart';

class OrderHistoryScreen extends ConsumerStatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  ConsumerState<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends ConsumerState<OrderHistoryScreen> {
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.hasClients &&
        _scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(orderHistoryProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(orderHistoryProvider);
    final orders = historyState.orders;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'My Orders',
          style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textPrimary),
            onPressed: () => ref.read(orderHistoryProvider.notifier).fetchHistory(),
          ),
        ],
      ),
      body: historyState.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : orders.isEmpty
              ? RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => ref.read(orderHistoryProvider.notifier).fetchHistory(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.7,
                        child: _buildEmptyState(context),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => ref.read(orderHistoryProvider.notifier).fetchHistory(),
                  child: ListView.builder(
                    controller: _scrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: orders.length + (historyState.isLoadingMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= orders.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                          child: Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
                            ),
                          ),
                        );
                      }
                      final order = orders[index];
                      return _buildOrderCard(context, ref, order);
                    },
                  ),
                ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return const EmptyStateView(
      icon: Icons.receipt_long_rounded,
      title: 'No orders yet',
      message: 'When you place orders, they will appear here.',
    );
  }

  Widget _buildOrderCard(BuildContext context, WidgetRef ref, PastOrder order) {
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');
    final formattedDate = dateFormat.format(order.createdAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: AppColors.border),
        boxShadow: const [BoxShadow(color: AppColors.black12, blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  order.orderNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _buildStatusBadge(order.status),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            formattedDate,
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          ),
          const Divider(height: 20, color: AppColors.border),

          Row(
            children: [
              const Icon(Icons.storefront_rounded, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  order.vendorName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ...order.items.map((item) {
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  Text(
                    '${item.quantity}x ',
                    style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                  Expanded(
                    child: Text(
                      item.name + (item.variantName != null ? ' (${item.variantName})' : ''),
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    CurrencyFormatter.format(item.totalPrice),
                    style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            );
          }),

          const Divider(height: 20, color: AppColors.border),

          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total Paid', style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                  Text(
                    CurrencyFormatter.format(order.totalAmount),
                    style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                  ),
                ],
              ),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: 6,
                children: [
                  if (order.isActive)
                    ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => OrderTrackingScreen(
                              orderId: order.id,
                              orderNumber: order.orderNumber,
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.radar_rounded, size: 16),
                      label: Text('Track Order', style: AppTypography.labelMedium.copyWith(fontWeight: FontWeight.w800)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                        shape: RoundedRectangleBorder(borderRadius: AppRadius.borderSm),
                      ),
                    ),

                  OutlinedButton.icon(
                    onPressed: () async {
                      final result = await ref.read(orderHistoryProvider.notifier).validateAndReorder(order);

                      if (!context.mounted) return;

                      if (!result.isStoreOperational) {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Store Closed'),
                            content: Text('${order.vendorName} is currently closed or out of operating hours.'),
                            actions: [TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK'))],
                          ),
                        );
                        return;
                      }

                      if (result.hasStockChanges && result.unavailableItems.isNotEmpty) {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Items Unavailable'),
                            content: Text(
                              'The following items are out of stock and were omitted: ${result.unavailableItems.join(", ")}',
                            ),
                            actions: [
                              ElevatedButton(
                                onPressed: () {
                                  Navigator.of(ctx).pop();
                                  Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const CartScreen()),
                                  );
                                },
                                child: const Text('Review Cart'),
                              ),
                            ],
                          ),
                        );
                        return;
                      }

                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                    icon: const Icon(Icons.replay_rounded, size: 16),
                    label: Text('Re-order', style: AppTypography.labelMedium.copyWith(fontWeight: FontWeight.w700)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                      shape: RoundedRectangleBorder(borderRadius: AppRadius.borderSm),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
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
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.borderXs),
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.15,
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w800, color: fg),
        ),
      ),
    );
  }
}
