/// Tolerant numeric parsers for handling numbers, numeric strings, and nulls
/// serialized by backend ORMs (e.g. Prisma Decimal -> string).
library;

double parseDouble(dynamic value, [double defaultValue = 0.0]) {
  if (value == null) return defaultValue;
  if (value is num) return value.toDouble();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return defaultValue;
    return double.tryParse(trimmed) ?? defaultValue;
  }
  return defaultValue;
}

int parseInt(dynamic value, [int defaultValue = 0]) {
  if (value == null) return defaultValue;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return defaultValue;
    final parsedInt = int.tryParse(trimmed);
    if (parsedInt != null) return parsedInt;
    final parsedDouble = double.tryParse(trimmed);
    if (parsedDouble != null) return parsedDouble.toInt();
  }
  return defaultValue;
}
