import 'package:flutter_test/flutter_test.dart';

import 'package:customer_app/features/auth/domain/suspension_notice.dart';

void main() {
  group('parseAccountSuspension', () {
    test('extracts the reason from the "suspended: <reason>. Please contact" message form', () {
      final notice = parseAccountSuspension(
        message: 'Your account has been suspended: Payment abuse. Please contact support.',
      );

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, 'Payment abuse');
    });

    test('prefers an explicit payload reason over the message substring', () {
      final notice = parseAccountSuspension(
        message: 'Your account has been suspended: Payment abuse. Please contact support.',
        statusCode: 403,
        explicitReason: 'Fraudulent chargebacks',
      );

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, 'Fraudulent chargebacks');
    });

    test('detects suspension via 403 status even when the message omits the word', () {
      final notice = parseAccountSuspension(
        message: 'Forbidden',
        statusCode: 403,
      );

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, isNull);
    });

    test('detects suspension via the ACCOUNT_SUSPENDED error flag', () {
      final notice = parseAccountSuspension(
        message: 'Request rejected',
        errorCode: 'ACCOUNT_SUSPENDED',
      );

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, isNull);
    });

    test('returns not-suspended for a generic error message', () {
      final notice = parseAccountSuspension(message: 'Too many attempts. Please try again later.');

      expect(notice.isSuspended, isFalse);
      expect(notice.reason, isNull);
    });

    test('missing reason marker yields a suspended notice without a reason', () {
      final notice = parseAccountSuspension(message: 'Your account is suspended');

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, isNull);
    });

    test('trailing text after "suspended:" without the contact terminator is captured whole', () {
      final notice = parseAccountSuspension(message: 'Account suspended: repeated refund abuse');

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, 'repeated refund abuse');
    });

    test('malformed empty payload never reports suspension', () {
      final notice = parseAccountSuspension(message: '');

      expect(notice.isSuspended, isFalse);
      expect(notice.reason, isNull);
    });

    test('empty explicit reason falls through to message parsing like a missing one', () {
      final notice = parseAccountSuspension(
        message: 'Your account has been suspended: Chargeback fraud. Please contact support.',
        explicitReason: '',
      );

      expect(notice.isSuspended, isTrue);
      expect(notice.reason, 'Chargeback fraud');
    });
  });
}
