/// One earnings aggregation window (today or trailing week) as computed by
/// the backend. `from`/`to` are only present on week windows; today has no
/// explicit bounds.
class RiderEarningsWindow {
  final DateTime? from;
  final DateTime? to;
  final double earnings;
  final int trips;
  final double codCollected;

  const RiderEarningsWindow({
    this.from,
    this.to,
    this.earnings = 0.0,
    this.trips = 0,
    this.codCollected = 0.0,
  });

  factory RiderEarningsWindow.fromJson(Map<String, dynamic> json) {
    return RiderEarningsWindow(
      from: DateTime.tryParse(json['from']?.toString() ?? ''),
      to: DateTime.tryParse(json['to']?.toString() ?? ''),
      earnings: double.tryParse(json['earnings']?.toString() ?? '') ?? 0.0,
      trips: int.tryParse(json['trips']?.toString() ?? '') ?? 0,
      codCollected: double.tryParse(json['codCollected']?.toString() ?? '') ?? 0.0,
    );
  }
}

/// Server truth for the earnings screen. Weekly figures must only ever come
/// from this response — deriving them from today's snapshot is fabrication.
class RiderEarningsSummary {
  final RiderEarningsWindow today;
  final RiderEarningsWindow week;

  const RiderEarningsSummary({
    this.today = const RiderEarningsWindow(),
    this.week = const RiderEarningsWindow(),
  });

  factory RiderEarningsSummary.fromJson(Map<String, dynamic> json) {
    return RiderEarningsSummary(
      today: json['today'] is Map<String, dynamic>
          ? RiderEarningsWindow.fromJson(json['today'] as Map<String, dynamic>)
          : const RiderEarningsWindow(),
      week: json['week'] is Map<String, dynamic>
          ? RiderEarningsWindow.fromJson(json['week'] as Map<String, dynamic>)
          : const RiderEarningsWindow(),
    );
  }
}
