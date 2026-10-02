import 'banner_model.dart';

/// Resolved deeplink behaviour for a tapped home-screen banner.
sealed class BannerAction {
  const BannerAction();
}

/// Opens the outlet detail screen for [outletId].
class OpenOutlet extends BannerAction {
  final String outletId;
  final String outletName;
  const OpenOutlet(this.outletId, this.outletName);
}

/// Opens discovery search seeded with the category name.
class OpenCategory extends BannerAction {
  final String categoryId;
  final String categoryName;
  const OpenCategory(this.categoryId, this.categoryName);
}

/// Opens an absolute http(s) URL in the system browser.
class OpenExternalUrl extends BannerAction {
  final Uri uri;
  const OpenExternalUrl(this.uri);
}

/// Banner carries no usable deeplink — open the generic search screen.
class OpenSearch extends BannerAction {
  const OpenSearch();
}

const _httpSchemes = {'http', 'https'};

/// Pure deeplink resolver: mirrors the admin BannerFormModal validation rules
/// so OUTLET/CATEGORY banners always carry a target and EXTERNAL banners
/// always carry an absolute http(s) URL (anything else degrades to search).
BannerAction resolveBannerAction(BannerModel banner) {
  final type = banner.actionType?.toUpperCase();
  final targetId = banner.actionValue?.trim();

  if (type == 'OUTLET' || type == 'VENDOR') {
    if (targetId != null && targetId.isNotEmpty) {
      return OpenOutlet(targetId, banner.targetName ?? banner.title);
    }
    return const OpenSearch();
  }

  if (type == 'CATEGORY') {
    if (targetId != null && targetId.isNotEmpty) {
      return OpenCategory(targetId, banner.targetName ?? banner.title);
    }
    return const OpenSearch();
  }

  if (type == 'EXTERNAL') {
    final raw = banner.targetUrl?.trim();
    if (raw != null && raw.isNotEmpty) {
      final uri = Uri.tryParse(raw);
      if (uri != null && uri.hasScheme && _httpSchemes.contains(uri.scheme.toLowerCase())) {
        return OpenExternalUrl(uri);
      }
    }
    return const OpenSearch();
  }

  return const OpenSearch();
}
