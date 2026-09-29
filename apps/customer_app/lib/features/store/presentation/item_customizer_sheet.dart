import 'package:flutter/material.dart';
import '../../../core/constants/constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/quantity_stepper.dart';
import '../../../core/widgets/sold_out_badge.dart';
import '../domain/store_catalog_model.dart';

class ItemCustomizerSheet extends StatefulWidget {
  final ProductModel product;
  final void Function({
    required ProductModel product,
    VariantModel? selectedVariant,
    required List<AddonModel> selectedAddons,
    required int quantity,
    String? specialInstructions,
    required double totalPrice,
  })? onAddToCart;

  const ItemCustomizerSheet({
    super.key,
    required this.product,
    this.onAddToCart,
  });

  static Future<void> show(
    BuildContext context, {
    required ProductModel product,
    void Function({
      required ProductModel product,
      VariantModel? selectedVariant,
      required List<AddonModel> selectedAddons,
      required int quantity,
      String? specialInstructions,
      required double totalPrice,
    })? onAddToCart,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.transparent,
      builder: (_) => ItemCustomizerSheet(
        product: product,
        onAddToCart: onAddToCart,
      ),
    );
  }

  @override
  State<ItemCustomizerSheet> createState() => _ItemCustomizerSheetState();
}

class _ItemCustomizerSheetState extends State<ItemCustomizerSheet> {
  VariantModel? _selectedVariant;
  final Set<AddonModel> _selectedAddons = {};
  int _quantity = 1;
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.product.variants.isNotEmpty) {
      final available = widget.product.variants.where((v) => v.isInStock);
      if (available.isNotEmpty) {
        _selectedVariant = available.first;
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  double get _unitPrice {
    final base = _selectedVariant?.price ?? widget.product.basePrice;
    final addonsTotal = _selectedAddons.fold<double>(0.0, (sum, a) => sum + a.price);
    return base + addonsTotal;
  }

  double get _totalPrice => _unitPrice * _quantity;

  bool get _canAddToCart {
    if (!widget.product.isInStock) return false;
    if (widget.product.variants.isNotEmpty && _selectedVariant == null) return false;
    return true;
  }

  void _handleAddToCart() {
    if (!_canAddToCart) return;
    widget.onAddToCart?.call(
      product: widget.product,
      selectedVariant: _selectedVariant,
      selectedAddons: _selectedAddons.toList(),
      quantity: _quantity,
      specialInstructions: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      totalPrice: _totalPrice,
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final viewInsets = MediaQuery.of(context).viewInsets;

    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        decoration: const BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.vertical(top: AppRadius.radiusXxl),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: AppColors.border,
                      borderRadius: AppRadius.borderXxs,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 22, color: AppColors.textSecondary),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              CurrencyFormatter.formatWithUnit(product.basePrice, product.unitType),
                              style: AppTypography.titleSmall.copyWith(
                                fontSize: 15,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!product.isInStock) const SoldOutBadge(),
                    ],
                  ),
                  if (product.description != null && product.description!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      product.description!,
                      style: AppTypography.bodySmall.copyWith(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                  const Divider(height: 28, color: AppColors.border),

                if (product.variants.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Choose Portion / Variant',
                        style: AppTypography.titleSmall,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: const BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: AppRadius.borderXs,
                        ),
                        child: Text(
                          'REQUIRED',
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ...product.variants.map((variant) {
                    final isSelected = _selectedVariant?.id == variant.id;
                    return InkWell(
                      onTap: variant.isInStock
                          ? () => setState(() => _selectedVariant = variant)
                          : null,
                      borderRadius: AppRadius.borderSm,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primaryContainer.withValues(alpha: 0.3) : AppColors.background,
                          borderRadius: AppRadius.borderSm,
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.border,
                          ),
                        ),
                        child: Row(
                          children: [
                            Radio<VariantModel>(
                              value: variant,
                              groupValue: _selectedVariant,
                              activeColor: AppColors.primary,
                              onChanged: variant.isInStock
                                  ? (val) => setState(() => _selectedVariant = val)
                                  : null,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                variant.name,
                                style: AppTypography.labelMedium.copyWith(
                                  fontSize: 13,
                                  color: variant.isInStock ? AppColors.textPrimary : AppColors.textMuted,
                                  decoration: variant.isInStock ? null : TextDecoration.lineThrough,
                                ),
                              ),
                            ),
                            Text(
                              variant.isInStock ? CurrencyFormatter.format(variant.price) : 'Unavailable',
                              style: AppTypography.labelMedium.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: variant.isInStock ? AppColors.textPrimary : AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const Divider(height: 24, color: AppColors.border),
                ],

                if (product.addonGroups.isNotEmpty) ...[
                  ...product.addonGroups.map((group) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          group.name,
                          style: AppTypography.titleSmall,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ...group.addons.map((addon) {
                          final isChecked = _selectedAddons.any((a) => a.id == addon.id);
                          return InkWell(
                            onTap: addon.isInStock
                                ? () {
                                    setState(() {
                                      if (isChecked) {
                                        _selectedAddons.removeWhere((a) => a.id == addon.id);
                                      } else {
                                        if (_selectedAddons.length < group.maxSelections) {
                                          _selectedAddons.add(addon);
                                        }
                                      }
                                    });
                                  }
                                : null,
                            borderRadius: AppRadius.borderSm,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                              decoration: BoxDecoration(
                                color: isChecked ? AppColors.primaryContainer.withValues(alpha: 0.3) : AppColors.background,
                                borderRadius: AppRadius.borderSm,
                                border: Border.all(
                                  color: isChecked ? AppColors.primary : AppColors.border,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Checkbox(
                                    value: isChecked,
                                    activeColor: AppColors.primary,
                                    onChanged: addon.isInStock
                                        ? (val) {
                                            setState(() {
                                              if (val == true) {
                                                if (_selectedAddons.length < group.maxSelections) {
                                                  _selectedAddons.add(addon);
                                                }
                                              } else {
                                                _selectedAddons.removeWhere((a) => a.id == addon.id);
                                              }
                                            });
                                          }
                                        : null,
                                  ),
                                  const SizedBox(width: AppSpacing.xs),
                                  Expanded(
                                    child: Text(
                                      addon.name,
                                      style: AppTypography.labelMedium.copyWith(
                                        fontSize: 13,
                                        color: addon.isInStock ? AppColors.textPrimary : AppColors.textMuted,
                                        decoration: addon.isInStock ? null : TextDecoration.lineThrough,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    addon.isInStock ? '+${CurrencyFormatter.format(addon.price)}' : 'Unavailable',
                                    style: AppTypography.labelMedium.copyWith(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: addon.isInStock ? AppColors.primary : AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                        const Divider(height: 24, color: AppColors.border),
                      ],
                    );
                  }),
                ],

                Text(
                  'Special Instructions for the Kitchen',
                  style: AppTypography.titleSmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _notesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'e.g. Less spicy, extra sauce, separate packaging...',
                    hintStyle: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.background,
                    border: const OutlineInputBorder(
                      borderRadius: AppRadius.borderSm,
                      borderSide: BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: const OutlineInputBorder(
                      borderRadius: AppRadius.borderSm,
                      borderSide: BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),

          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            decoration: const BoxDecoration(
              color: AppColors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  QuantityStepper(
                    quantity: _quantity,
                    minQuantity: 1,
                    onIncrement: _canAddToCart ? () => setState(() => _quantity++) : () {},
                    onDecrement: (_quantity > 1 && _canAddToCart) ? () => setState(() => _quantity--) : () {},
                  ),
                  const SizedBox(width: 10),

                  Expanded(
                    child: SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _canAddToCart ? _handleAddToCart : null,
                        style: ElevatedButton.styleFrom(
                          padding: AppSpacing.edgeInsetsHorizontalMd,
                          backgroundColor: AppColors.primary,
                          disabledBackgroundColor: AppColors.textMuted.withValues(alpha: 0.3),
                          foregroundColor: AppColors.white,
                          elevation: 0,
                          shape: const RoundedRectangleBorder(
                            borderRadius: AppRadius.borderMd,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                _canAddToCart ? 'Add to Cart' : 'Currently Unavailable',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.labelLarge.copyWith(color: AppColors.white),
                              ),
                            ),
                            if (_canAddToCart) ...[
                              const SizedBox(width: AppSpacing.xs),
                              Text(
                                CurrencyFormatter.format(_totalPrice),
                                style: AppTypography.labelLarge.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.white,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
  }
}
