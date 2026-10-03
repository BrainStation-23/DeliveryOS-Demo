import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/constants.dart';
import '../../../core/localization/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../domain/user_model.dart';
import 'widgets/account_suspended_card.dart';
import '../../location/presentation/map_location_picker_screen.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  final String phoneNumber;

  const OtpVerificationScreen({
    super.key,
    required this.phoneNumber,
  });

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  int _resendCountdown = 45;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendCountdown = 45);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCountdown > 0) {
        setState(() => _resendCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otpValue => _controllers.map((c) => c.text).join();

  Future<void> _handleVerify() async {
    final otp = _otpValue;
    if (otp.length != 6) return;

    final success = await ref.read(authProvider.notifier).verifyOtp(widget.phoneNumber, otp);
    if (success && mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MapLocationPickerScreen(isInitialOnboarding: true)),
        (route) => false,
      );
    }
  }

  void _fillDevOtp() {
    const code = '123456';
    for (int i = 0; i < 6; i++) {
      _controllers[i].text = code[i];
    }
    _handleVerify();
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
                        l10n.translate('otp_title'),
                        style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      RichText(
                        text: TextSpan(
                          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                          children: [
                            TextSpan(text: '${l10n.translate('otp_subtitle')} '),
                            TextSpan(
                              text: widget.phoneNumber,
                              style: AppTypography.bodyMedium.copyWith(
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 36),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (index) {
                          return Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 3.0),
                              child: SizedBox(
                                height: 54,
                                child: TextField(
                                  controller: _controllers[index],
                                  focusNode: _focusNodes[index],
                                  keyboardType: TextInputType.number,
                                  textAlign: TextAlign.center,
                                  maxLength: 1,
                                  style: AppTypography.titleLarge.copyWith(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  decoration: InputDecoration(
                                    counterText: '',
                                    filled: true,
                                    fillColor: AppColors.white,
                                    contentPadding: EdgeInsets.zero,
                                    border: const OutlineInputBorder(
                                      borderRadius: AppRadius.borderMd,
                                      borderSide: BorderSide(color: AppColors.border),
                                    ),
                                    focusedBorder: const OutlineInputBorder(
                                      borderRadius: AppRadius.borderMd,
                                      borderSide: BorderSide(color: AppColors.primary, width: 2),
                                    ),
                                  ),
                                  onChanged: (val) {
                                    if (val.isNotEmpty && index < 5) {
                                      _focusNodes[index + 1].requestFocus();
                                    } else if (val.isEmpty && index > 0) {
                                      _focusNodes[index - 1].requestFocus();
                                    }
                                    if (_otpValue.length == 6) {
                                      _handleVerify();
                                    }
                                  },
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (kDebugMode)
                        Center(
                          child: TextButton.icon(
                            onPressed: _fillDevOtp,
                            icon: const Icon(Icons.auto_fix_high_rounded, size: 16, color: AppColors.primary),
                            label: Text(
                              l10n.translate('dev_otp_hint'),
                              style: AppTypography.labelMedium.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
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
                          Center(
                            child: Text(
                              authState.errorMessage!,
                              style: AppTypography.bodySmall.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.error,
                              ),
                            ),
                          ),
                      ],
                      const Spacer(),
                      const SizedBox(height: AppSpacing.xxl),
                      Center(
                        child: _resendCountdown > 0
                            ? Text(
                                '${l10n.translate('resend_in')} ${_resendCountdown}s',
                                style: AppTypography.bodySmall.copyWith(
                                  fontSize: 13,
                                  color: AppColors.textMuted,
                                ),
                              )
                            : TextButton(
                                onPressed: () {
                                  ref.read(authProvider.notifier).sendOtp(widget.phoneNumber);
                                  _startTimer();
                                },
                                child: Text(
                                  l10n.translate('resend_code'),
                                  style: AppTypography.labelLarge.copyWith(
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: (_otpValue.length == 6 && !isLoading) ? _handleVerify : null,
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
                                  l10n.translate('verify_btn'),
                                  style: AppTypography.labelLarge.copyWith(
                                    fontSize: 16,
                                    color: AppColors.white,
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
