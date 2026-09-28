import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStorage {
  final SharedPreferences _prefs;
  final FlutterSecureStorage _secure;

  String? _accessTokenCache;
  String? _refreshTokenCache;

  LocalStorage(this._prefs, {FlutterSecureStorage? secureStorage})
      : _secure = secureStorage ?? const FlutterSecureStorage();

  static const String _keyAccessToken = 'auth_access_token';
  static const String _keyRefreshToken = 'auth_refresh_token';
  static const String _keyRiderProfile = 'rider_profile_data';
  static const String _keyIsOnline = 'rider_is_online';

  static Future<LocalStorage> init() async {
    final prefs = await SharedPreferences.getInstance();
    final storage = LocalStorage(prefs);
    await storage._migrateTokensToSecureStorage();
    return storage;
  }

  /// Loads tokens from Keystore/Keychain-backed storage, migrating any legacy
  /// plaintext SharedPreferences values into secure storage and purging them.
  Future<void> _migrateTokensToSecureStorage() async {
    try {
      _accessTokenCache = await _secure.read(key: _keyAccessToken);
      _refreshTokenCache = await _secure.read(key: _keyRefreshToken);

      final legacyAccess = _prefs.getString(_keyAccessToken);
      final legacyRefresh = _prefs.getString(_keyRefreshToken);
      if (_accessTokenCache == null && legacyAccess != null) {
        await setAccessToken(legacyAccess);
      }
      if (_refreshTokenCache == null && legacyRefresh != null) {
        await setRefreshToken(legacyRefresh);
      }
      if (legacyAccess != null || legacyRefresh != null) {
        await _prefs.remove(_keyAccessToken);
        await _prefs.remove(_keyRefreshToken);
      }
    } catch (_) {
      // Platform channel unavailable (unit tests) — keep prefs-backed fallback
      _accessTokenCache ??= _prefs.getString(_keyAccessToken);
      _refreshTokenCache ??= _prefs.getString(_keyRefreshToken);
    }
  }

  String? getAccessToken() => _accessTokenCache ?? _prefs.getString(_keyAccessToken);
  Future<void> setAccessToken(String token) async {
    _accessTokenCache = token;
    try {
      await _secure.write(key: _keyAccessToken, value: token);
    } catch (_) {
      await _prefs.setString(_keyAccessToken, token);
    }
  }

  String? getRefreshToken() => _refreshTokenCache ?? _prefs.getString(_keyRefreshToken);
  Future<void> setRefreshToken(String token) async {
    _refreshTokenCache = token;
    try {
      await _secure.write(key: _keyRefreshToken, value: token);
    } catch (_) {
      await _prefs.setString(_keyRefreshToken, token);
    }
  }

  String? getRiderProfileJson() => _prefs.getString(_keyRiderProfile);
  Future<bool> setRiderProfileJson(String json) => _prefs.setString(_keyRiderProfile, json);

  bool getIsOnline() => _prefs.getBool(_keyIsOnline) ?? false;
  Future<bool> setIsOnline(bool online) => _prefs.setBool(_keyIsOnline, online);

  Future<void> clearAuth() async {
    _accessTokenCache = null;
    _refreshTokenCache = null;
    try {
      await _secure.delete(key: _keyAccessToken);
      await _secure.delete(key: _keyRefreshToken);
    } catch (_) {
      await _prefs.remove(_keyAccessToken);
      await _prefs.remove(_keyRefreshToken);
    }
    await _prefs.remove(_keyRiderProfile);
    await _prefs.remove(_keyIsOnline);
  }
}

final localStorageProvider = Provider<LocalStorage>((ref) {
  throw UnimplementedError('Initialize localStorageProvider in ProviderScope');
});
