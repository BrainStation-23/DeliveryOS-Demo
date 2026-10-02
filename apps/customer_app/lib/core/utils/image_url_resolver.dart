import '../constants/api_constants.dart';

/// Resolves server-stored media URLs for display. The backend persists upload
/// paths relative to its origin (`/uploads/...`, ADR-016) so assets stay
/// host-portable; clients must join them onto the API origin — never the
/// `/api/v1` base, since static media is served at the root.
String resolveImageUrl(String? url) {
  final trimmed = url?.trim() ?? '';
  if (trimmed.isEmpty) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  final origin =
      Uri.parse(ApiConstants.baseUrl).replace(path: '', query: '', fragment: '').toString();
  return '$origin$trimmed';
}
