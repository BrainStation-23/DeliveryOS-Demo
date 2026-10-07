import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/core/constants/constants.dart';

void main() {
  group('Customer App Design System Tokens Tests', () {
    test('AppColors defines required brand, surface, status, and utility palette', () {
      expect(AppColors.primary, const Color(0xFFFF5200));
      expect(AppColors.secondary, const Color(0xFF10B981));
      expect(AppColors.background, const Color(0xFFF8FAFC));
      expect(AppColors.surface, const Color(0xFFFFFFFF));
      expect(AppColors.card, const Color(0xFFFFFFFF));
      expect(AppColors.border, const Color(0xFFE2E8F0));
      expect(AppColors.white, const Color(0xFFFFFFFF));
      expect(AppColors.black, const Color(0xFF000000));
      expect(AppColors.transparent, const Color(0x00000000));
      expect(AppColors.star, const Color(0xFFF59E0B));
      expect(AppColors.amber, const Color(0xFFF59E0B));

      // Neutral grey scale
      expect(AppColors.grey50, isNotNull);
      expect(AppColors.grey100, isNotNull);
      expect(AppColors.grey200, isNotNull);
      expect(AppColors.grey300, isNotNull);
      expect(AppColors.grey400, isNotNull);
      expect(AppColors.grey500, isNotNull);
      expect(AppColors.grey600, isNotNull);
      expect(AppColors.grey700, isNotNull);
      expect(AppColors.grey800, isNotNull);
      expect(AppColors.grey900, isNotNull);

      // Status variants
      expect(AppColors.successLight, const Color(0xFFDCFCE7));
      expect(AppColors.successGreen, const Color(0xFF16A34A));
      expect(AppColors.warningLight, const Color(0xFFFEF3C7));
      expect(AppColors.warningDark, const Color(0xFFD97706));
      expect(AppColors.errorLight, const Color(0xFFFEE2E2));
      expect(AppColors.errorDark, const Color(0xFFDC2626));
      expect(AppColors.errorText, const Color(0xFF991B1B));
      expect(AppColors.errorTextMedium, const Color(0xFFB91C1C));
      expect(AppColors.errorTextDark, const Color(0xFF7F1D1D));
      expect(AppColors.infoLight, const Color(0xFFEFF6FF));
      expect(AppColors.infoBlue, const Color(0xFF2563EB));

      // Map tokens
      expect(AppColors.mapBackground, const Color(0xFFE5E3DF));
      expect(AppColors.mapWater, const Color(0xFFAAD3DF));
    });

    test('AppTypography defines cohesive text style hierarchy', () {
      expect(AppTypography.headlineLarge.fontSize, 28);
      expect(AppTypography.headlineLarge.fontWeight, FontWeight.w800);

      expect(AppTypography.headlineMedium.fontSize, 22);
      expect(AppTypography.headlineMedium.fontWeight, FontWeight.w700);

      expect(AppTypography.headlineSmall.fontSize, 20);
      expect(AppTypography.headlineSmall.fontWeight, FontWeight.w700);

      expect(AppTypography.titleLarge.fontSize, 18);
      expect(AppTypography.titleLarge.fontWeight, FontWeight.w700);

      expect(AppTypography.titleMedium.fontSize, 16);
      expect(AppTypography.titleMedium.fontWeight, FontWeight.w600);

      expect(AppTypography.titleSmall.fontSize, 14);
      expect(AppTypography.titleSmall.fontWeight, FontWeight.w600);

      expect(AppTypography.bodyLarge.fontSize, 16);
      expect(AppTypography.bodyLarge.fontWeight, FontWeight.w400);

      expect(AppTypography.bodyMedium.fontSize, 14);
      expect(AppTypography.bodyMedium.fontWeight, FontWeight.w400);

      expect(AppTypography.bodySmall.fontSize, 12);
      expect(AppTypography.bodySmall.fontWeight, FontWeight.w400);

      expect(AppTypography.labelLarge.fontSize, 14);
      expect(AppTypography.labelLarge.fontWeight, FontWeight.w700);

      expect(AppTypography.labelMedium.fontSize, 12);
      expect(AppTypography.labelMedium.fontWeight, FontWeight.w600);

      expect(AppTypography.labelSmall.fontSize, 11);
      expect(AppTypography.labelSmall.fontWeight, FontWeight.w600);

      expect(AppTypography.caption.fontSize, 10);
      expect(AppTypography.caption.fontWeight, FontWeight.w500);
    });

    test('AppSpacing and AppRadius define consistent spacing and radius scales', () {
      expect(AppSpacing.xxs, 2.0);
      expect(AppSpacing.xs, 4.0);
      expect(AppSpacing.sm, 8.0);
      expect(AppSpacing.md, 12.0);
      expect(AppSpacing.lg, 16.0);
      expect(AppSpacing.xl, 20.0);
      expect(AppSpacing.xxl, 24.0);
      expect(AppSpacing.xxxl, 32.0);

      expect(AppRadius.xxs, 2.0);
      expect(AppRadius.xs, 4.0);
      expect(AppRadius.sm, 8.0);
      expect(AppRadius.md, 12.0);
      expect(AppRadius.lg, 16.0);
      expect(AppRadius.xl, 20.0);
      expect(AppRadius.xxl, 24.0);
      expect(AppRadius.full, 999.0);

      expect(AppRadius.borderSm, const BorderRadius.all(Radius.circular(8.0)));
      expect(AppRadius.borderMd, const BorderRadius.all(Radius.circular(12.0)));
      expect(AppRadius.borderLg, const BorderRadius.all(Radius.circular(16.0)));
      expect(AppRadius.borderFull, const BorderRadius.all(Radius.circular(999.0)));
    });

    test('AccountSuspendedCard uses only design-token colors (no hardcoded values)', () {
      final source = File('lib/features/auth/presentation/widgets/account_suspended_card.dart')
          .readAsStringSync();

      expect(source, isNot(contains('Color(0x')));
      expect(source, isNot(contains(RegExp(r'\bColors\.'))));
      expect(source, contains('AppColors.'));
    });
  });
}
