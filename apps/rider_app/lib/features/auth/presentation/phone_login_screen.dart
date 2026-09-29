import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/design_tokens.dart';
import '../../../core/widgets/app_primary_button.dart';
import '../domain/auth_models.dart';
import '../providers/auth_provider.dart';
import 'otp_verification_screen.dart';
import 'widgets/auth_brand_header.dart';
import 'widgets/auth_tab_toggle.dart';
import 'widgets/pilot_accounts_debug_card.dart';
import 'widgets/vehicle_type_selector.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  bool _isRegistering = false;
  VehicleType _selectedVehicle = VehicleType.motorcycle;

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleProceed() async {
    final rawPhone = _phoneController.text.trim();
    if (rawPhone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid mobile number'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final String formattedPhone;
    if (rawPhone.startsWith('+') && !rawPhone.startsWith('+880')) {
      formattedPhone = rawPhone;
    } else {
      String cleanDigits = rawPhone.replaceAll(RegExp(r'\D'), '');
      if (cleanDigits.startsWith('880')) {
        cleanDigits = cleanDigits.substring(3);
      }
      if (cleanDigits.startsWith('0')) {
        cleanDigits = cleanDigits.substring(1);
      }
      if (cleanDigits.length < 9) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please enter a valid mobile number (min 9 digits)'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      formattedPhone = '+880$cleanDigits';
    }

    if (_isRegistering && _nameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your full name for rider registration'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final success = await ref.read(riderAuthProvider.notifier).requestOtp(
          phone: formattedPhone,
          fullName: _isRegistering ? _nameController.text.trim() : null,
          vehicleType: _selectedVehicle,
        );

    if (success && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OtpVerificationScreen(
            phoneNumber: formattedPhone,
            isRegistering: _isRegistering,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(riderAuthProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl, vertical: AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AuthBrandHeader(),
                const SizedBox(height: AppSpacing.xxl),

                AuthTabToggle(
                  isRegistering: _isRegistering,
                  onTabChanged: (val) => setState(() => _isRegistering = val),
                ),
                const SizedBox(height: AppSpacing.xl),

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
                      if (_isRegistering) ...[
                        Text(
                          'FULL NAME',
                          style: AppTypography.badgeText.copyWith(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _nameController,
                          style: AppTypography.h3,
                          decoration: const InputDecoration(
                            hintText: 'e.g. Tanvir Hossain',
                            prefixIcon: Icon(Icons.person_rounded, color: AppColors.primary),
                            filled: true,
                            fillColor: AppColors.background,
                            contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 14),
                            border: OutlineInputBorder(
                              borderRadius: AppRadius.roundedMd,
                              borderSide: BorderSide(color: AppColors.border),
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Text(
                          'VEHICLE TYPE',
                          style: AppTypography.badgeText.copyWith(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        VehicleTypeSelector(
                          selectedVehicle: _selectedVehicle,
                          onVehicleSelected: (type) => setState(() => _selectedVehicle = type),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],

                      Text(
                        'MOBILE NUMBER',
                        style: AppTypography.badgeText.copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        style: AppTypography.h2.copyWith(
                          fontSize: 18,
                          letterSpacing: 1.0,
                        ),
                        decoration: InputDecoration(
                          prefixIcon: Container(
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 14),
                            child: Text(
                              '🇧🇩 +880',
                              style: AppTypography.bodyBold.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          hintText: '1700112233',
                          filled: true,
                          fillColor: AppColors.background,
                          contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 14),
                          border: const OutlineInputBorder(
                            borderRadius: AppRadius.roundedMd,
                            borderSide: BorderSide(color: AppColors.border),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      AppPrimaryButton(
                        label: _isRegistering ? 'Submit Application' : 'Send Verification OTP',
                        isLoading: authState.isLoading,
                        onPressed: _handleProceed,
                        trailingIcon: const Icon(Icons.arrow_forward_rounded, size: 20),
                      ),
                    ],
                  ),
                ),
                if (kDebugMode) ...[
                  const SizedBox(height: AppSpacing.xl),
                  PilotAccountsDebugCard(
                    onSelectApproved: () {
                      setState(() {
                        _isRegistering = false;
                        _phoneController.text = '1700112233';
                      });
                    },
                    onSelectPending: () {
                      setState(() {
                        _isRegistering = true;
                        _nameController.text = 'Shafiqul Islam';
                        _phoneController.text = '1700998877';
                      });
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
