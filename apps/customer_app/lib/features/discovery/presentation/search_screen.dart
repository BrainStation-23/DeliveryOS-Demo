import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/vendor_conflict_dialog.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../cart/providers/cart_provider.dart';
import '../../store/domain/store_catalog_model.dart';
import '../../store/presentation/item_customizer_sheet.dart';
import '../../store/presentation/outlet_detail_screen.dart';
import '../domain/search_result_model.dart';
import '../providers/search_provider.dart';
import 'widgets/search_item_card.dart';
import 'widgets/search_store_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  /// Optional seed query (e.g. a banner deeplink landing on a category name).
  final String? initialQuery;

  const SearchScreen({super.key, this.initialQuery});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
    final seed = widget.initialQuery?.trim();
    if (seed != null && seed.isNotEmpty) {
      // Deeplink seeds run once on mount so the results are visible immediately.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(searchProvider.notifier).onQueryChanged(seed);
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);
    final results = searchState.results;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.textPrimary),
          onPressed: () {
            ref.read(searchProvider.notifier).clearSearch();
            Navigator.of(context).pop();
          },
        ),
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Search dishes, groceries, outlets...',
            hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
            border: InputBorder.none,
            suffixIcon: _controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textSecondary),
                    onPressed: () {
                      _controller.clear();
                      ref.read(searchProvider.notifier).clearSearch();
                    },
                  )
                : null,
          ),
          onChanged: (val) {
            ref.read(searchProvider.notifier).onQueryChanged(val);
            setState(() {});
          },
        ),
      ),
      body: searchState.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : (results.outlets.isEmpty && results.items.isEmpty)
              ? _buildEmptyOrSuggestionsState()
              : _buildResultsList(results),
    );
  }

  Widget _buildEmptyOrSuggestionsState() {
    if (_controller.text.trim().isNotEmpty) {
      return EmptyStateView(
        icon: Icons.search_off_rounded,
        title: 'No matches found for "${_controller.text.trim()}"',
        message: 'Try searching for "Biryani", "Kacchi", or "Burger"',
      );
    }

    return Padding(
      padding: AppSpacing.edgeInsetsXl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Popular Searches',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _buildSuggestionChip('Kacchi Biryani'),
              _buildSuggestionChip('Borhani'),
              _buildSuggestionChip('Beef Kebab'),
              _buildSuggestionChip('Fresh Milk'),
              _buildSuggestionChip('Chicken Biryani'),
              _buildSuggestionChip('Groceries'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionChip(String label) {
    return InkWell(
      onTap: () {
        _controller.text = label;
        ref.read(searchProvider.notifier).onQueryChanged(label);
        setState(() {});
      },
      borderRadius: AppRadius.borderFull,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: AppRadius.borderFull,
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          label,
          style: AppTypography.labelMedium,
        ),
      ),
    );
  }

  Widget _buildResultsList(SearchResult results) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      children: [
        if (results.outlets.isNotEmpty) ...[
          Text(
            'Stores & Restaurants (${results.outlets.length})',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...results.outlets.map(
            (outlet) => SearchStoreCard(
              outlet: outlet,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => OutletDetailScreen(
                      vendorId: outlet.id,
                      initialVendorName: outlet.displayName,
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],

        if (results.items.isNotEmpty) ...[
          Text(
            'Dishes & Groceries (${results.items.length})',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...results.items.map(
            (item) => SearchItemCard(
              item: item,
              onAdd: () => _openItemCustomizer(item),
            ),
          ),
        ],
      ],
    );
  }

  void _openItemCustomizer(SearchItem item) {
    final product = ProductModel(
      id: item.id,
      name: item.name,
      description: item.description,
      basePrice: item.basePrice,
      unitType: item.unitType,
      imageUrl: item.imageUrl,
      isInStock: item.isInStock,
    );

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
        _handleAddToCart(
          item: item,
          product: product,
          selectedVariant: selectedVariant,
          selectedAddons: selectedAddons,
          quantity: quantity,
          specialInstructions: specialInstructions,
          unitPrice: totalPrice / quantity,
        );
      },
    );
  }

  void _handleAddToCart({
    required SearchItem item,
    required ProductModel product,
    required VariantModel? selectedVariant,
    required List<AddonModel> selectedAddons,
    required int quantity,
    required String? specialInstructions,
    required double unitPrice,
  }) {
    final result = ref.read(cartProvider.notifier).addItem(
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          product: product,
          selectedVariant: selectedVariant,
          selectedAddons: selectedAddons,
          quantity: quantity,
          specialInstructions: specialInstructions,
          unitPrice: unitPrice,
        );

    if (result == AddToCartResult.vendorConflict) {
      showVendorConflictDialog(
        context: context,
        newVendorName: item.vendorName,
        onConfirmReplace: () {
          ref.read(cartProvider.notifier).addItem(
                vendorId: item.vendorId,
                vendorName: item.vendorName,
                product: product,
                selectedVariant: selectedVariant,
                selectedAddons: selectedAddons,
                quantity: quantity,
                specialInstructions: specialInstructions,
                unitPrice: unitPrice,
                forceReplace: true,
              );
          _showAddedSnackbar(product.name, quantity);
        },
      );
    } else {
      _showAddedSnackbar(product.name, quantity);
    }
  }

  void _showAddedSnackbar(String productName, int quantity) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added $quantity x $productName to cart'),
        backgroundColor: AppColors.secondary,
        action: SnackBarAction(
          label: 'VIEW CART',
          textColor: AppColors.white,
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CartScreen()),
            );
          },
        ),
      ),
    );
  }
}
