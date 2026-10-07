/// Outcome of detecting an account suspension across the auth failure paths
/// (OTP request, OTP verification, forced session-expiry logout).
class AccountSuspensionNotice {
  final bool isSuspended;
  final String? reason;

  const AccountSuspensionNotice({required this.isSuspended, this.reason});
}

/// Single shared parser for account-suspension signals. A suspension is
/// detected from a 403 status, an ACCOUNT_SUSPENDED error flag, or the word
/// "suspend" in the message. The reason prefers an explicit payload field and
/// falls back to the embedded "suspended: ..." message segment before the
/// ". Please contact" terminator.
AccountSuspensionNotice parseAccountSuspension({
  required String message,
  int? statusCode,
  String? errorCode,
  String? explicitReason,
}) {
  final isSuspended = statusCode == 403 ||
      errorCode == 'ACCOUNT_SUSPENDED' ||
      message.toLowerCase().contains('suspend');
  if (!isSuspended) {
    return const AccountSuspensionNotice(isSuspended: false);
  }

  String? reason = (explicitReason != null && explicitReason.trim().isNotEmpty)
      ? explicitReason
      : null;
  if (reason == null && message.contains('suspended:')) {
    final start = message.indexOf('suspended:') + 10;
    final end = message.indexOf('. Please contact');
    reason = (end > start ? message.substring(start, end) : message.substring(start)).trim();
  }
  return AccountSuspensionNotice(isSuspended: true, reason: reason);
}
