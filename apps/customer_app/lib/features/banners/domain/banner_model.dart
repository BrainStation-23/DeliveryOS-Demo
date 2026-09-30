import '../../../../core/utils/numeric_parser.dart';

class BannerModel {
  final String id;
  final String title;
  final String? subtitle;
  final String imageUrl;
  final String? actionType;
  final String? actionValue;
  final String? deepLink;
  final int sortOrder;

  BannerModel({
    required this.id,
    required this.title,
    this.subtitle,
    required this.imageUrl,
    this.actionType,
    this.actionValue,
    this.deepLink,
    this.sortOrder = 0,
  });

  factory BannerModel.fromJson(Map<String, dynamic> json) {
    return BannerModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String? ?? '',
      actionType: (json['linkType'] ?? json['link_type'] ?? json['actionType'] ?? json['action_type'])?.toString(),
      actionValue: (json['targetId'] ?? json['target_id'] ?? json['actionValue'] ?? json['action_value'])?.toString(),
      deepLink: (json['deepLink'] ?? json['deep_link'])?.toString(),
      sortOrder: parseInt(json['sortOrder'] ?? json['sort_order'], 0),
    );
  }
}
