import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/design_tokens.dart';
import '../../../core/widgets/app_primary_button.dart';
import '../../dashboard/presentation/rider_dashboard_screen.dart';
import '../providers/auth_provider.dart';
import 'pending_approval_screen.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  final String phoneNumber;
  final bool isRegistering;

  const OtpVerificationScreen({
    super.key,
    required this.phoneNumber,
    required this.isRegistering,
  });

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final TextEditingController _otpController = TextEditingController();

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the 6-digit OTP code'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final success = await ref.read(riderAuthProvider.notifier).verifyOtp(otp: otp);
    final authState = ref.read(riderAuthProvider);

    if (!mounted) return;

    if (success && authState.isAuthenticated) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const RiderDashboardScreen()),
        (route) => false,
      );
    } else if (authState.isPendingApproval) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const PendingApprovalScreen()),
        (route) => false,
      );
    } else if (authState.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authState.error!),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(riderAuthProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Verification',
          style: AppTypography.h2.copyWith(fontSize: 18),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl, vertical: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight.withValues(alpha: 0.1),
                            borderRadius: AppRadius.roundedMd,
                          ),
                          child: const Icon(Icons.mark_email_read_rounded, color: AppColors.primary, size: 28),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Security OTP Code',
                                style: AppTypography.h3.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Sent to ${widget.phoneNumber}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxl),

                    TextField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 6,
                      style: AppTypography.h1.copyWith(
                        color: AppColors.primary,
                        letterSpacing: 10.0,
                      ),
                      decoration: InputDecoration(
                        hintText: '••••••',
                        counterText: '',
                        filled: true,
                        fillColor: AppColors.background,
                        contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border, width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    if (kDebugMode) ...[
                      Center(
                        child: TextButton.icon(
                          onPressed: () => setState(() => _otpController.text = '123456'),
                          icon: const Icon(Icons.flash_on_rounded, size: 16, color: AppColors.info),
                          label: Text(
                            'Auto-fill static OTP (123456)',
                            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.info),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    AppPrimaryButton(
                      label: 'Verify & Continue',
                      isLoading: authState.isLoading,
                      onPressed: _verify,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
