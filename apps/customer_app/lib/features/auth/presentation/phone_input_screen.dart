import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/localization/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../domain/user_model.dart';
import 'otp_verification_screen.dart';
import 'widgets/account_suspended_card.dart';
import '../../home/presentation/home_screen.dart';

class PhoneInputScreen extends ConsumerStatefulWidget {
  const PhoneInputScreen({super.key});

  @override
  ConsumerState<PhoneInputScreen> createState() => _PhoneInputScreenState();
}

class _PhoneInputScreenState extends ConsumerState<PhoneInputScreen> {
  final TextEditingController _phoneController = TextEditingController();
  String _selectedCountryCode = '+880';
  bool _isValid = false;

  @override
  void initState() {
    super.initState();
    _phoneController.addListener(() {
      final text = _phoneController.text.trim();
      setState(() {
        _isValid = text.length >= 9;
      });
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  String get _fullPhoneNumber {
    var raw = _phoneController.text.trim();
    if (raw.startsWith('0')) {
      raw = raw.substring(1);
    }
    return '$_selectedCountryCode$raw';
  }

  Future<void> _handleSendOtp() async {
    if (!_isValid) return;

    final success = await ref.read(authProvider.notifier).sendOtp(_fullPhoneNumber);
    if (success && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OtpVerificationScreen(phoneNumber: _fullPhoneNumber),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final authState = ref.watch(authProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xxl,
                vertical: AppSpacing.md,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 24.0),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.translate('login_title'),
                        style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        l10n.translate('login_subtitle'),
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      ),
                      if (authState.errorMessage != null && authState.errorMessage!.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        if (authState.isSuspended || authState.errorMessage!.toLowerCase().contains('suspend'))
                          AccountSuspendedCard(
                            reason: authState.suspensionReason,
                            message: authState.errorMessage,
                            onDismiss: () => ref.read(authProvider.notifier).clearError(),
                          )
                        else
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.sm + 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.1),
                              borderRadius: AppRadius.borderMd,
                              border: Border.all(
                                color: AppColors.error.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.error_outline_rounded,
                                  size: 18,
                                  color: AppColors.error,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text(
                                    authState.errorMessage!,
                                    style: AppTypography.bodySmall.copyWith(
                                      color: AppColors.error,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                      const SizedBox(height: AppSpacing.xxxl),
                      Container(
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: AppRadius.borderLg,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                              decoration: const BoxDecoration(
                                border: Border(right: BorderSide(color: AppColors.border)),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedCountryCode,
                                  items: const [
                                    DropdownMenuItem(value: '+880', child: Text('🇧🇩 +880')),
                                    DropdownMenuItem(value: '+966', child: Text('🇸🇦 +966')),
                                  ],
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedCountryCode = val);
                                  },
                                ),
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                decoration: InputDecoration(
                                  hintText: l10n.translate('phone_hint'),
                                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                                  border: InputBorder.none,
                                  contentPadding: AppSpacing.edgeInsetsHorizontalLg,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (kDebugMode)
                        GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedCountryCode = '+880';
                              _phoneController.text = '1700000005';
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                            decoration: const BoxDecoration(
                              color: AppColors.primaryContainer,
                              borderRadius: AppRadius.borderSm,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.flash_on_rounded, size: 16, color: AppColors.primary),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    'Demo Customer: +8801700000005',
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.labelMedium.copyWith(
                                      color: AppColors.primaryDark,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      const Spacer(),
                      const SizedBox(height: AppSpacing.xxl),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: (_isValid && !isLoading) ? _handleSendOtp : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
                            foregroundColor: AppColors.white,
                            elevation: 0,
                            shape: const RoundedRectangleBorder(
                              borderRadius: AppRadius.borderLg,
                            ),
                          ),
                          child: isLoading
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: AppColors.white,
                                  ),
                                )
                              : Text(
                                  l10n.translate('send_otp'),
                                  style: AppTypography.labelLarge.copyWith(
                                    fontSize: 16,
                                    color: AppColors.white,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Center(
                        child: TextButton(
                          onPressed: () async {
                            await ref.read(authProvider.notifier).continueAsGuest();
                            if (context.mounted) {
                              Navigator.of(context).pushAndRemoveUntil(
                                MaterialPageRoute(builder: (_) => const HomeScreen()),
                                (route) => false,
                              );
                            }
                          },
                          child: Text(
                            l10n.translate('skip_guest'),
                            style: AppTypography.labelLarge.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
