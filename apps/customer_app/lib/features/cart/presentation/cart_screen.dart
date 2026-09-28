import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../addresses/domain/address_model.dart';
import '../../addresses/presentation/address_book_screen.dart';
import '../../addresses/providers/address_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/presentation/phone_input_screen.dart';
import '../../location/providers/location_provider.dart';
import '../../orders/presentation/payment_webview_screen.dart';
import '../../tracking/presentation/order_tracking_screen.dart';
import '../domain/cart_item_model.dart';
import '../providers/cart_provider.dart';
import 'widgets/address_geofence_banner.dart';
import 'widgets/coupon_input_section.dart';
import 'widgets/delivery_mode_selector.dart';
import 'widgets/payment_method_selector.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handlePlaceOrder() async {
    final auth = ref.read(authProvider);

    if (auth.isGuest) {
      final shouldLogin = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
          title: Text('Login Required to Order', style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800)),
          content: Text(
            'Please login with your phone number so we can track and deliver your order.',
            style: AppTypography.bodyMedium,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text('Cancel', style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
              ),
              child: Text('Login Now', style: AppTypography.labelLarge.copyWith(color: AppColors.white)),
            ),
          ],
        ),
      );

      if (shouldLogin == true && mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const PhoneInputScreen()),
        );
      }
      return;
    }

    String? deliveryAddressId;
    final cart = ref.read(cartProvider);
    if (cart.deliveryMethod == DeliveryMethod.homeDelivery) {
      final addrState = ref.read(addressProvider);
      if (addrState.selectedAddress == null) {
        final picked = await Navigator.of(context).push<CustomerAddressModel>(
          MaterialPageRoute(builder: (_) => const AddressBookScreen(isSelectionMode: true)),
        );
        if (picked == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Please select or add a delivery address to proceed.')),
            );
          }
          return;
        }
        ref.read(addressProvider.notifier).selectAddress(picked);
        ref.read(cartProvider.notifier).validateCoverage(customLat: picked.latitude, customLng: picked.longitude);
        deliveryAddressId = picked.id;
      } else {
        deliveryAddressId = addrState.selectedAddress!.id;
      }
    }

    setState(() => _isSubmitting = true);
    final result = await ref.read(cartProvider.notifier).checkout(
          customerNotes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
          deliveryAddressId: deliveryAddressId,
        );
    setState(() => _isSubmitting = false);

    if (!mounted) return;

    if (result['success'] == true) {
      final orderId = result['orderId'] as String? ?? '';
      final orderNumber = result['orderNumber'] as String? ?? '#ORD-001';
      final isOnline = result['paymentMethod'] == 'ONLINE_GATEWAY';
      final paymentSession = result['paymentSession'] as Map<String, dynamic>?;

      // Real payment flow: host the gateway session and poll until settled
      var paymentResult = PaymentWebViewResult.paid;
      final paymentUrl = paymentSession?['paymentUrl'] as String?;
      final transactionId = paymentSession?['transactionId'] as String?;
      if (isOnline && paymentUrl != null && transactionId != null && mounted) {
        paymentResult = await PaymentWebViewScreen.launch(
          context,
          paymentUrl: paymentUrl,
          transactionId: transactionId,
        );
      }
      if (!mounted) return;

      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
          title: Row(
            children: [
              Icon(
                isOnline && paymentResult != PaymentWebViewResult.paid
                    ? Icons.schedule_rounded
                    : isOnline
                        ? Icons.verified_rounded
                        : Icons.check_circle_rounded,
                color: isOnline && paymentResult != PaymentWebViewResult.paid
                    ? AppColors.warning
                    : isOnline
                        ? AppColors.primary
                        : AppColors.secondary,
                size: 28,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  isOnline && paymentResult != PaymentWebViewResult.paid
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
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop();
              },
              child: Text('Return to Home', style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary)),
            ),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                    builder: (_) => OrderTrackingScreen(
                      orderId: orderId,
                      orderNumber: orderNumber,
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderSm),
              ),
              icon: const Icon(Icons.navigation_rounded, size: 16),
              label: Text(isOnline ? 'Go to Tracking' : 'Track Order', style: AppTypography.labelLarge.copyWith(color: AppColors.white)),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] as String? ?? 'Order placement failed.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);
    final userLocation = ref.watch(locationProvider).location;
    final addressState = ref.watch(addressProvider);

    if (cartState.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.white,
          elevation: 0.5,
          title: Text(
            'My Cart',
            style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: EmptyStateView(
          icon: Icons.remove_shopping_cart_rounded,
          title: 'Your cart is empty',
          message: 'Browse restaurants and stores to add your favorite items',
          actionButtonText: 'Start Exploring',
          onActionPressed: () => Navigator.of(context).pop(),
        ),
      );
    }

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
              'My Cart',
              style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
            ),
            if (cartState.vendorName != null)
              Text(
                cartState.vendorName!,
                style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w500),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep_rounded, color: AppColors.error),
            tooltip: 'Clear Cart',
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: Text('Clear Cart?', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
                  content: Text('Are you sure you want to remove all items from your cart?', style: AppTypography.bodyMedium),
                  actions: [
                    TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text('Cancel', style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary))),
                    TextButton(
                      onPressed: () {
                        ref.read(cartProvider.notifier).clearCart();
                        Navigator.of(ctx).pop();
                      },
                      child: Text('Clear', style: AppTypography.labelLarge.copyWith(color: AppColors.error)),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: AppSpacing.edgeInsetsLg,
        children: [
          DeliveryModeSelector(
            selectedMethod: cartState.deliveryMethod,
            deliveryFee: cartState.deliveryFee,
            onMethodChanged: (method) {
              ref.read(cartProvider.notifier).setDeliveryMethod(method);
            },
          ),
          const SizedBox(height: AppSpacing.md),

          if (cartState.deliveryMethod == DeliveryMethod.homeDelivery) ...[
            Container(
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
                              addressState.selectedAddress != null
                                  ? (addressState.selectedAddress!.label.toLowerCase() == 'home'
                                      ? Icons.home_rounded
                                      : (addressState.selectedAddress!.label.toLowerCase() == 'work'
                                          ? Icons.work_rounded
                                          : Icons.location_on_rounded))
                                  : Icons.my_location_rounded,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Flexible(
                              child: Text(
                                addressState.selectedAddress != null
                                    ? 'Deliver to: ${addressState.selectedAddress!.label}'
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
                        onPressed: () async {
                          final picked = await Navigator.of(context).push<CustomerAddressModel>(
                            MaterialPageRoute(
                              builder: (_) => const AddressBookScreen(isSelectionMode: true),
                            ),
                          );
                          if (picked != null) {
                            ref.read(addressProvider.notifier).selectAddress(picked);
                            ref.read(cartProvider.notifier).validateCoverage(
                                  customLat: picked.latitude,
                                  customLng: picked.longitude,
                                );
                          }
                        },
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
                    addressState.selectedAddress?.addressLine ?? userLocation.addressLine,
                    style: AppTypography.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            AddressGeofenceBanner(
              isWithinCoverage: cartState.isWithinCoverage,
              currentAddress: addressState.selectedAddress?.addressLine ?? userLocation.addressLine,
              coverageError: cartState.coverageError,
              onAddressChanged: () {
                final lat = addressState.selectedAddress?.latitude;
                final lng = addressState.selectedAddress?.longitude;
                ref.read(cartProvider.notifier).validateCoverage(customLat: lat, customLng: lng);
              },
            ),
            const SizedBox(height: 14),
          ],

          if (!cartState.isVendorActive || cartState.isVendorBusy) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: !cartState.isVendorActive ? AppColors.errorContainer : AppColors.warningContainer,
                borderRadius: AppRadius.borderMd,
                border: Border.all(
                  color: !cartState.isVendorActive ? AppColors.errorBorderLight : AppColors.warningBorder,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    !cartState.isVendorActive ? Icons.store_mall_directory_outlined : Icons.timer_outlined,
                    color: !cartState.isVendorActive ? AppColors.errorDark : AppColors.warningDark,
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      !cartState.isVendorActive
                          ? '${cartState.vendorName ?? "Store"} is currently closed and not accepting orders.'
                          : '${cartState.vendorName ?? "Store"} has temporarily paused orders due to rush hour.',
                      style: AppTypography.titleSmall.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: !cartState.isVendorActive ? AppColors.errorText : AppColors.warningText,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          Text(
            'Order Items',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...List.generate(cartState.items.length, (index) {
            final item = cartState.items[index];
            return _buildCartItemCard(item, index);
          }),
          const SizedBox(height: AppSpacing.lg),

          Text(
            'Promotions & Vouchers',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          CouponInputSection(
            appliedCoupon: cartState.couponCode,
            couponDiscount: cartState.couponDiscount,
            isLoading: cartState.isApplyingCoupon,
            message: cartState.couponMessage,
            onApplyCoupon: (code) {
              ref.read(cartProvider.notifier).applyCoupon(code);
            },
            onRemoveCoupon: () {
              ref.read(cartProvider.notifier).removeCoupon();
            },
          ),
          const SizedBox(height: AppSpacing.lg),

          Text(
            'Cooking & Delivery Notes',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _notesController,
            decoration: InputDecoration(
              hintText: 'e.g. Ring doorbell, leave at door, extra napkins...',
              hintStyle: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.white,
              border: const OutlineInputBorder(
                borderRadius: AppRadius.borderSm,
                borderSide: BorderSide(color: AppColors.border),
              ),
              enabledBorder: const OutlineInputBorder(
                borderRadius: AppRadius.borderSm,
                borderSide: BorderSide(color: AppColors.border),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          Text(
            'Payment Method',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          PaymentMethodSelector(
            selectedMethod: cartState.paymentMethod,
            onMethodChanged: (method) {
              ref.read(cartProvider.notifier).setPaymentMethod(method);
            },
          ),
          const SizedBox(height: AppSpacing.lg),

          _buildSummaryCard(cartState),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),

      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: (cartState.canCheckout && !_isSubmitting) ? _handlePlaceOrder : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
                foregroundColor: AppColors.white,
                elevation: 0,
                shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.white),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            !cartState.isVendorActive
                                ? 'Store Currently Closed'
                                : cartState.isVendorBusy
                                    ? 'Store Paused (Rush Hour)'
                                    : (!cartState.isWithinCoverage && cartState.deliveryMethod == DeliveryMethod.homeDelivery)
                                        ? 'Address Out of Coverage'
                                        : 'Place Order (${cartState.totalItemCount} items)',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.titleSmall.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          CurrencyFormatter.format(cartState.totalPayable),
                          style: AppTypography.titleMedium.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.white,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCartItemCard(CartItem item, int index) {
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
                if (item.selectedAddons.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Extras: ${item.selectedAddons.map((a) => a.name).join(", ")}',
                    style: AppTypography.labelSmall.copyWith(
                      fontWeight: FontWeight.normal,
                      color: AppColors.textSecondary,
                    ),
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

          Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: AppRadius.borderSm,
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.remove_rounded, size: 16),
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    ref.read(cartProvider.notifier).updateQuantity(index, item.quantity - 1);
                  },
                ),
                Text(
                  '${item.quantity}',
                  style: AppTypography.labelMedium.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_rounded, size: 16),
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    ref.read(cartProvider.notifier).updateQuantity(index, item.quantity + 1);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(CartState cart) {
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
          _buildSummaryRow('Item Subtotal', CurrencyFormatter.format(cart.grossSubtotal)),
          if (cart.couponDiscount > 0)
            _buildSummaryRow(
              'Coupon Discount (${cart.couponCode})',
              CurrencyFormatter.formatDiscount(cart.couponDiscount),
              color: AppColors.secondary,
            ),
          _buildSummaryRow(
            'Delivery Fee',
            cart.deliveryMethod == DeliveryMethod.takeaway ? 'FREE' : CurrencyFormatter.format(cart.deliveryFee),
          ),
          const Divider(height: 20, color: AppColors.border),
          _buildSummaryRow(
            'Total Payable',
            CurrencyFormatter.format(cart.totalPayable),
            isBold: true,
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color}) {
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
