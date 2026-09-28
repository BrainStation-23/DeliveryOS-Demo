/// Display-only map viewport defaults (Dhaka center). These exist purely so
/// map widgets have a sane initial camera position before a real GPS fix or
/// order coordinates arrive — they are never sent to the backend as telemetry.
class MapDefaults {
  static const double centerLatitude = 23.7925;
  static const double centerLongitude = 90.4078;
}
