import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/localization/language_provider.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/presentation/phone_input_screen.dart';
import '../../banners/presentation/banner_carousel.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../cart/providers/cart_provider.dart';
import '../../discovery/presentation/search_screen.dart';
import '../../location/providers/location_provider.dart';
import '../../location/presentation/map_location_picker_screen.dart';
import '../../orders/presentation/order_history_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../store/presentation/outlet_detail_screen.dart';
import 'widgets/category_chip.dart';
import 'widgets/outlet_card.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String? _selectedCategory;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final authState = ref.watch(authProvider);
    final locState = ref.watch(locationProvider);
    final currentLocale = ref.watch(languageProvider);
    final cartState = ref.watch(cartProvider);

    final displayedVendors = locState.nearbyVendors.where((v) {
      if (_selectedCategory == null) return true;
      return v.vertical.toUpperCase() == _selectedCategory;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                color: AppColors.white,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: AppRadius.borderSm,
                                ),
                                child: const Icon(
                                  Icons.delivery_dining_rounded,
                                  color: AppColors.white,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Flexible(
                                child: Text(
                                  l10n.translate('app_title'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w900),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PopupMenuButton<String>(
                              initialValue: currentLocale.languageCode,
                              icon: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.background,
                                  borderRadius: AppRadius.borderLg,
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.language_rounded, size: 14, color: AppColors.textSecondary),
                                    const SizedBox(width: 3),
                                    Text(
                                      currentLocale.languageCode.toUpperCase(),
                                      style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                              onSelected: (code) {
                                ref.read(languageProvider.notifier).setLanguage(code);
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'en', child: Text('English')),
                                PopupMenuItem(value: 'ar', child: Text('العربية (RTL)')),
                                PopupMenuItem(value: 'bn', child: Text('বাংলা')),
                              ],
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              padding: AppSpacing.edgeInsetsXs,
                              constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                              icon: Badge(
                                isLabelVisible: cartState.items.isNotEmpty,
                                label: Text('${cartState.totalItemCount}'),
                                backgroundColor: AppColors.primary,
                                child: const Icon(Icons.shopping_bag_outlined, size: 21, color: AppColors.textPrimary),
                              ),
                              tooltip: 'Cart',
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const CartScreen()),
                                );
                              },
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              padding: AppSpacing.edgeInsetsXs,
                              constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                              icon: const Icon(Icons.receipt_long_outlined, size: 21, color: AppColors.textPrimary),
                              tooltip: 'My Orders',
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const OrderHistoryScreen()),
                                );
                              },
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              padding: AppSpacing.edgeInsetsXs,
                              constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                              icon: const Icon(Icons.person_outline_rounded, size: 21, color: AppColors.textPrimary),
                              tooltip: 'My Profile',
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const ProfileScreen()),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const MapLocationPickerScreen(isInitialOnboarding: false),
                          ),
                        );
                      },
                      borderRadius: AppRadius.borderMd,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: AppRadius.borderMd,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.place_rounded, color: AppColors.primary, size: 22),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        l10n.translate('home_greeting'),
                                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: const BoxDecoration(
                                          color: AppColors.primaryContainer,
                                          borderRadius: AppRadius.borderXs,
                                        ),
                                        child: Text(
                                          locState.location.addressType.name.toUpperCase(),
                                          style: AppTypography.caption.copyWith(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    locState.location.addressLine,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.titleSmall.copyWith(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                              decoration: BoxDecoration(
                                color: AppColors.white,
                                borderRadius: AppRadius.borderXs,
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Text(
                                l10n.translate('change_location'),
                                style: AppTypography.labelSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
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
            ),

            if (authState.isGuest)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.warningContainer,
                    borderRadius: AppRadius.borderSm,
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, color: AppColors.warningDark, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Browsing as Guest. Log in to place orders and track live deliveries.',
                          style: AppTypography.bodySmall.copyWith(color: AppColors.warningText),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PhoneInputScreen()),
                          );
                        },
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          'Login',
                          style: AppTypography.labelMedium.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.warningTextDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SearchScreen()),
                    );
                  },
                  borderRadius: AppRadius.borderMd,
                  child: Container(
                    height: 46,
                    padding: AppSpacing.edgeInsetsHorizontalMd,
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: AppRadius.borderMd,
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            l10n.translate('search_hint'),
                            style: AppTypography.bodySmall.copyWith(
                              fontSize: 13,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: AppColors.background,
                            borderRadius: AppRadius.borderSm,
                          ),
                          child: const Icon(Icons.tune_rounded, size: 16, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 6.0, bottom: 8.0),
                child: BannerCarousel(
                  onBannerTap: (banner) {
                    if ((banner.actionType == 'OUTLET' || banner.actionType == 'VENDOR') && banner.actionValue != null) {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => OutletDetailScreen(
                            vendorId: banner.actionValue!,
                            initialVendorName: banner.title,
                          ),
                        ),
                      );
                    } else {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SearchScreen()),
                      );
                    }
                  },
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 6.0),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.secondary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${locState.nearbyStoreCount} ${l10n.translate('stores_found')}',
                      style: AppTypography.labelMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 8.0, bottom: 12.0),
                child: SizedBox(
                  height: 38,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: AppSpacing.edgeInsetsHorizontalLg,
                    children: [
                      CategoryChip(
                        label: 'All',
                        isSelected: _selectedCategory == null,
                        onTap: () => setState(() => _selectedCategory = null),
                      ),
                      CategoryChip(
                        label: l10n.translate('restaurants'),
                        isSelected: _selectedCategory == 'FOOD',
                        onTap: () => setState(() => _selectedCategory = 'FOOD'),
                      ),
                      CategoryChip(
                        label: l10n.translate('groceries'),
                        isSelected: _selectedCategory == 'GROCERY',
                        onTap: () => setState(() => _selectedCategory = 'GROCERY'),
                      ),
                      CategoryChip(
                        label: 'Pharmacy',
                        isSelected: _selectedCategory == 'PHARMACY',
                        onTap: () => setState(() => _selectedCategory = 'PHARMACY'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            SliverPadding(
              padding: AppSpacing.edgeInsetsHorizontalLg,
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (locState.isLoading)
                    const Padding(
                      padding: EdgeInsets.all(40.0),
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  else if (displayedVendors.isEmpty)
                    EmptyStateView(
                      icon: Icons.storefront_outlined,
                      title: 'No outlets found in this area',
                      message: _selectedCategory == null
                          ? 'We could not find any active stores delivering to your current location.'
                          : 'No stores available in this category nearby.',
                    )
                  else
                    ...displayedVendors.map((vendor) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: OutletCard(vendor: vendor),
                      );
                    }),
                  const SizedBox(height: AppSpacing.xxl),
                ]),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: cartState.isEmpty
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
              decoration: const BoxDecoration(
                color: AppColors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
                boxShadow: [
                  BoxShadow(color: AppColors.black12, blurRadius: 8, offset: Offset(0, -2)),
                ],
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 48,
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
                      shape: const RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.white.withValues(alpha: 0.25),
                                  borderRadius: AppRadius.borderXs,
                                ),
                                child: Text(
                                  '${cartState.totalItemCount}',
                                  style: AppTypography.labelMedium.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'View Cart (${cartState.vendorName ?? "Outlet"})',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.labelLarge.copyWith(
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
                          CurrencyFormatter.format(cartState.totalPayable),
                          style: AppTypography.titleSmall.copyWith(
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
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
}
