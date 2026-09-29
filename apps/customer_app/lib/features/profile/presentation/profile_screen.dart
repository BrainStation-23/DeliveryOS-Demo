import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/localization/language_provider.dart';
import '../../../core/utils/phone_call_launcher.dart';
import '../../addresses/presentation/address_book_screen.dart';
import '../../auth/providers/auth_provider.dart';
import '../../orders/presentation/order_history_screen.dart';
import '../../splash/presentation/splash_screen.dart';
import '../providers/profile_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(profileProvider.notifier).loadProfile());
  }

  void _showEditProfileDialog(String currentName, String currentEmail) {
    final nameController = TextEditingController(text: currentName);
    final emailController = TextEditingController(text: currentEmail);
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
          title: Text('Edit Profile', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Full Name', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(
                    hintText: 'Your Full Name',
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                  ),
                ),
                const SizedBox(height: 14),
                Text('Email Address', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    hintText: 'e.g. name@example.com',
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: AppRadius.borderSm, borderSide: const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel', style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: isSaving
                  ? null
                  : () async {
                      setDialogState(() => isSaving = true);
                      final success = await ref.read(profileProvider.notifier).updateProfile(
                        fullName: nameController.text.trim(),
                        email: emailController.text.trim().isNotEmpty ? emailController.text.trim() : null,
                      );
                      if (success && mounted) {
                        if (ctx.mounted) Navigator.pop(ctx);
                        return;
                      }
                      setDialogState(() => isSaving = false);
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                shape: RoundedRectangleBorder(borderRadius: AppRadius.borderSm),
              ),
              child: isSaving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2))
                  : Text('Save', style: AppTypography.labelMedium.copyWith(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final currentLocale = ref.watch(languageProvider);
    final profileState = ref.watch(profileProvider);
    final profile = profileState.profile;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('My Profile & Account', style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w800)),
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_rounded, color: AppColors.primary, size: 20),
            tooltip: 'Edit Profile',
            onPressed: () => _showEditProfileDialog(profile.fullName, profile.email),
          ),
        ],
      ),
      body: profileState.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: AppRadius.borderLg,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            profile.fullName.isNotEmpty ? profile.fullName.substring(0, 1).toUpperCase() : 'C',
                            style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w900, color: AppColors.primary),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile.fullName,
                              style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              profile.phone,
                              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                            ),
                            if (profile.email.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Text(
                                profile.email,
                                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg, horizontal: AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: AppRadius.borderMd,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          children: [
                            Text('TOTAL ORDERS', style: AppTypography.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                            const SizedBox(height: AppSpacing.xs),
                            Text('${profile.totalOrders}', style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w900, color: AppColors.primary)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg, horizontal: AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: AppRadius.borderMd,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          children: [
                            Text('SAVED ADDRESSES', style: AppTypography.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                            const SizedBox(height: AppSpacing.xs),
                            Text('${profile.totalAddresses}', style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w900, color: AppColors.secondary)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xl),
                Text('Account Preferences', style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.textSecondary)),
                const SizedBox(height: AppSpacing.sm),

                Container(
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: AppRadius.borderLg,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.place_outlined, color: AppColors.primary),
                        title: Text('Saved Delivery Addresses', style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
                        subtitle: Text('Manage home, office, and preferred drop points', style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                        onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressBookScreen()));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.receipt_long_outlined, color: AppColors.primary),
                        title: Text('My Order History', style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
                        subtitle: Text('View and reorder previous meals and groceries', style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                        onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const OrderHistoryScreen()));
                        },
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.language_rounded, color: AppColors.primary),
                        title: Text('Language / ভাষা', style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                          currentLocale.languageCode == 'bn'
                              ? 'বাংলা (Bengali)'
                              : currentLocale.languageCode == 'ar'
                                  ? 'العربية (Arabic)'
                                  : 'English (US)',
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                        ),
                        trailing: PopupMenuButton<String>(
                          initialValue: currentLocale.languageCode,
                          icon: const Icon(Icons.swap_horiz_rounded, color: AppColors.primary),
                          onSelected: (code) {
                            ref.read(languageProvider.notifier).setLanguage(code);
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'en', child: Text('English')),
                            PopupMenuItem(value: 'bn', child: Text('বাংলা (Bengali)')),
                            PopupMenuItem(value: 'ar', child: Text('العربية (Arabic RTL)')),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.support_agent_rounded, color: AppColors.primary),
                        title: Text('24/7 Customer Support', style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
                        subtitle: Text('Call +880 1700-000000 for order inquiries & help', style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                        trailing: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary, size: 20),
                        onTap: () => makeDirectPhoneCall('+8801700000000'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xxl),
                OutlinedButton.icon(
                  onPressed: () async {
                    final shouldLogout = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        shape: RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
                        title: Text('Logout', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
                        content: Text('Are you sure you want to log out of DeliveryOS?', style: AppTypography.bodyMedium),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: Text('Cancel', style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary)),
                          ),
                          ElevatedButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: AppColors.white),
                            child: Text('Logout', style: AppTypography.labelMedium.copyWith(fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    );

                    if (shouldLogout == true && context.mounted) {
                      await ref.read(authProvider.notifier).logout();
                      if (context.mounted) {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const SplashScreen()),
                          (route) => false,
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.logout_rounded, color: AppColors.error),
                  label: Text(l10n.translate('logout'), style: AppTypography.labelMedium.copyWith(color: AppColors.error, fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.errorBorderLight),
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                    shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
                  ),
                ),
              ],
            ),
    );
  }
}
