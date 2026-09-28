import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/error_retry_view.dart';
import '../../../core/widgets/store_status_badge.dart';
import '../../../core/widgets/vendor_conflict_dialog.dart';
import '../../cart/domain/cart_item_model.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../cart/providers/cart_provider.dart';
import '../domain/store_catalog_model.dart';
import '../providers/store_catalog_provider.dart';
import 'item_customizer_sheet.dart';
import 'widgets/product_menu_card.dart';

class OutletDetailScreen extends ConsumerStatefulWidget {
  final String vendorId;
  final String? initialVendorName;

  const OutletDetailScreen({
    super.key,
    required this.vendorId,
    this.initialVendorName,
  });

  @override
  ConsumerState<OutletDetailScreen> createState() => _OutletDetailScreenState();
}

class _OutletDetailScreenState extends ConsumerState<OutletDetailScreen> {
  int _selectedCategoryIndex = 0;

  Future<void> _makeCall(String phoneNumber) async {
    final uri = Uri.parse('tel:$phoneNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _onAddToCart({
    required VendorCatalog catalog,
    required ProductModel product,
    VariantModel? selectedVariant,
    required List<AddonModel> selectedAddons,
    required int quantity,
    String? specialInstructions,
    required double totalPrice,
  }) {
    final result = ref.read(cartProvider.notifier).addItem(
          vendorId: catalog.id,
          vendorName: catalog.name,
          vendorDeliveryRadiusKm: catalog.deliveryRadiusKm,
          product: product,
          selectedVariant: selectedVariant,
          selectedAddons: selectedAddons,
          quantity: quantity,
          specialInstructions: specialInstructions,
          unitPrice: totalPrice / quantity,
        );

    if (result == AddToCartResult.vendorConflict) {
      showVendorConflictDialog(
        context: context,
        newVendorName: catalog.name,
        onConfirmReplace: () {
          ref.read(cartProvider.notifier).addItem(
                vendorId: catalog.id,
                vendorName: catalog.name,
                vendorDeliveryRadiusKm: catalog.deliveryRadiusKm,
                product: product,
                selectedVariant: selectedVariant,
                selectedAddons: selectedAddons,
                quantity: quantity,
                specialInstructions: specialInstructions,
                unitPrice: totalPrice / quantity,
                forceReplace: true,
              );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Added $quantity x ${product.name} to cart'),
              backgroundColor: AppColors.secondary,
            ),
          );
        },
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Added $quantity x ${product.name} to cart'),
          backgroundColor: AppColors.secondary,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _openItemCustomizer(VendorCatalog catalog, ProductModel product) {
    ItemCustomizerSheet.show(
      context,
      product: product,
      onAddToCart: ({
        required product,
        selectedVariant,
        required selectedAddons,
        required quantity,
        specialInstructions,
        required totalPrice,
      }) {
        _onAddToCart(
          catalog: catalog,
          product: product,
          selectedVariant: selectedVariant,
          selectedAddons: selectedAddons,
          quantity: quantity,
          specialInstructions: specialInstructions,
          totalPrice: totalPrice,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalogAsync = ref.watch(storeCatalogProvider(widget.vendorId));
    final cartState = ref.watch(cartProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: catalogAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => ErrorRetryView(
          message: 'Failed to load outlet menu: $err',
          onRetry: () => ref.refresh(storeCatalogProvider(widget.vendorId)),
        ),
        data: (catalog) => _buildCatalogBody(catalog),
      ),
      bottomNavigationBar: cartState.isEmpty
          ? null
          : _buildViewCartBottomBar(context, cartState),
    );
  }

  Widget _buildViewCartBottomBar(BuildContext context, CartState cart) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(color: AppColors.black12, blurRadius: 8, offset: Offset(0, -3)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.white,
              elevation: 0,
              shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                        decoration: BoxDecoration(
                          color: AppColors.white.withValues(alpha: 0.25),
                          borderRadius: AppRadius.borderSm,
                        ),
                        child: Text(
                          '${cart.totalItemCount}',
                          style: AppTypography.labelMedium.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          'View Cart',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.titleSmall.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  CurrencyFormatter.format(cart.grossSubtotal),
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
    );
  }

  Widget _buildCatalogBody(VendorCatalog catalog) {
    final categories = catalog.categories;
    final activeCategory = categories.isNotEmpty ? categories[_selectedCategoryIndex] : null;

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 180.0,
          pinned: true,
          backgroundColor: AppColors.primary,
          leading: IconButton(
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: AppColors.textPrimary),
            ),
            onPressed: () => Navigator.of(context).pop(),
          ),
          actions: [
            if (catalog.contactPhone != null)
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.white.withValues(alpha: 0.9),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.phone_rounded, size: 18, color: AppColors.primary),
                ),
                tooltip: 'Call Store',
                onPressed: () => _makeCall(catalog.contactPhone!),
              ),
            const SizedBox(width: AppSpacing.sm),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                catalog.bannerUrl != null
                    ? CachedNetworkImage(
                        imageUrl: catalog.bannerUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(color: AppColors.card),
                        errorWidget: (_, __, ___) => Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [AppColors.primaryLight, AppColors.primary],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                        ),
                      )
                    : Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.primaryLight, AppColors.primary],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: const Center(
                          child: Icon(Icons.restaurant_rounded, size: 64, color: AppColors.white24),
                        ),
                      ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.black.withValues(alpha: 0.6),
                        AppColors.transparent,
                      ],
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Container(
            color: AppColors.white,
            padding: AppSpacing.edgeInsetsLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        catalog.name,
                        style: AppTypography.headlineMedium.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    StoreStatusBadge(
                      isOpen: catalog.isActive,
                      isBusy: false,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.place_outlined, size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        catalog.addressText,
                        style: AppTypography.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: 6,
                  children: [
                    _buildMetaBadge(
                      icon: Icons.timer_outlined,
                      label: '${catalog.estimatedPrepTimeMinutes} min prep',
                    ),
                    _buildMetaBadge(
                      icon: Icons.radar_rounded,
                      label: '${catalog.deliveryRadiusKm.toStringAsFixed(0)} km radius',
                    ),
                    _buildMetaBadge(
                      icon: Icons.star_rounded,
                      label: '4.8 (240+)',
                      color: AppColors.amber,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        if (categories.isNotEmpty)
          SliverPersistentHeader(
            pinned: true,
            delegate: _CategoryHeaderDelegate(
              categories: categories,
              selectedIndex: _selectedCategoryIndex,
              onSelect: (index) {
                setState(() => _selectedCategoryIndex = index);
              },
            ),
          ),

        if (activeCategory != null && activeCategory.products.isNotEmpty)
          SliverPadding(
            padding: AppSpacing.edgeInsetsLg,
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final product = activeCategory.products[index];
                  return ProductMenuCard(
                    product: product,
                    onAdd: () => _openItemCustomizer(catalog, product),
                  );
                },
                childCount: activeCategory.products.length,
              ),
            ),
          )
        else
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Text(
                'No products available in this category',
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMetaBadge({
    required IconData icon,
    required String label,
    Color? color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: AppRadius.borderSm,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color ?? AppColors.textSecondary),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTypography.labelSmall,
          ),
        ],
      ),
    );
  }
}

class _CategoryHeaderDelegate extends SliverPersistentHeaderDelegate {
  final List<CategoryModel> categories;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  _CategoryHeaderDelegate({
    required this.categories,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  double get minExtent => 48;
  @override
  double get maxExtent => 48;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: AppSpacing.edgeInsetsHorizontalLg,
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final isSelected = index == selectedIndex;
          return Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: ChoiceChip(
              label: Text(categories[index].name),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.background,
              labelStyle: AppTypography.labelMedium.copyWith(
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.white : AppColors.textPrimary,
              ),
              side: BorderSide(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
              onSelected: (_) => onSelect(index),
            ),
          );
        },
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _CategoryHeaderDelegate oldDelegate) {
    return oldDelegate.selectedIndex != selectedIndex || oldDelegate.categories != categories;
  }
}
