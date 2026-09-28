import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStorage {
  static const String _keyToken = 'auth_access_token';
  static const String _keyRefreshToken = 'auth_refresh_token';
  static const String _keyLanguage = 'selected_language';
  static const String _keyIsGuest = 'is_guest_mode';
  static const String _keyUser = 'cached_user_profile';
  static const String _keySavedLocation = 'saved_delivery_location';

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secure;

  String? _accessTokenCache;
  String? _refreshTokenCache;

  LocalStorage(this._prefs, {FlutterSecureStorage? secureStorage})
      : _secure = secureStorage ?? const FlutterSecureStorage();

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
      _accessTokenCache = await _secure.read(key: _keyToken);
      _refreshTokenCache = await _secure.read(key: _keyRefreshToken);

      final legacyAccess = _prefs.getString(_keyToken);
      final legacyRefresh = _prefs.getString(_keyRefreshToken);
      if (_accessTokenCache == null && legacyAccess != null) {
        await setAccessToken(legacyAccess);
      }
      if (_refreshTokenCache == null && legacyRefresh != null) {
        await setRefreshToken(legacyRefresh);
      }
      if (legacyAccess != null || legacyRefresh != null) {
        await _prefs.remove(_keyToken);
        await _prefs.remove(_keyRefreshToken);
      }
    } catch (_) {
      // Platform channel unavailable (unit tests) — keep prefs-backed fallback
      _accessTokenCache ??= _prefs.getString(_keyToken);
      _refreshTokenCache ??= _prefs.getString(_keyRefreshToken);
    }
  }

  String? getAccessToken() => _accessTokenCache ?? _prefs.getString(_keyToken);
  Future<void> setAccessToken(String token) async {
    _accessTokenCache = token;
    try {
      await _secure.write(key: _keyToken, value: token);
    } catch (_) {
      await _prefs.setString(_keyToken, token);
    }
  }

  Future<void> removeAccessToken() async {
    _accessTokenCache = null;
    try {
      await _secure.delete(key: _keyToken);
    } catch (_) {
      await _prefs.remove(_keyToken);
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

  String getLanguage() => _prefs.getString(_keyLanguage) ?? 'en';
  Future<bool> setLanguage(String langCode) => _prefs.setString(_keyLanguage, langCode);

  bool isGuest() => _prefs.getBool(_keyIsGuest) ?? false;
  Future<bool> setGuest(bool isGuest) => _prefs.setBool(_keyIsGuest, isGuest);

  Map<String, dynamic>? getUserProfile() {
    final str = _prefs.getString(_keyUser);
    if (str == null) return null;
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<bool> setUserProfile(Map<String, dynamic> user) =>
      _prefs.setString(_keyUser, jsonEncode(user));

  Map<String, dynamic>? getSavedLocation() {
    final str = _prefs.getString(_keySavedLocation);
    if (str == null) return null;
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<bool> setSavedLocation(Map<String, dynamic> location) =>
      _prefs.setString(_keySavedLocation, jsonEncode(location));

  Future<void> clearSession() async {
    _accessTokenCache = null;
    _refreshTokenCache = null;
    try {
      await _secure.delete(key: _keyToken);
      await _secure.delete(key: _keyRefreshToken);
    } catch (_) {
      await _prefs.remove(_keyToken);
      await _prefs.remove(_keyRefreshToken);
    }
    await _prefs.remove(_keyUser);
    await _prefs.setBool(_keyIsGuest, false);
  }
}
