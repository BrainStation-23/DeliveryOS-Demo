# DeliveryOS — Mobile Release Process

Covers the Android release path for `apps/customer_app` and `apps/rider_app`.

## 1. One-time setup (per machine / CI runner)

**Release keystore** — generate once, store securely (never commit):

```bash
keytool -genkey -v -keystore ~/deliveryos-release.keystore \
  -alias deliveryos -keyalg RSA -keysize 2048 -validity 10000
```

**key.properties** — create `apps/<app>/android/key.properties` (gitignored):

```properties
storePassword=<keystore password>
keyPassword=<key password>
keyAlias=deliveryos
storeFile=/absolute/path/to/deliveryos-release.keystore
```

Without this file, release builds fall back to debug signing (fine for local `flutter run --release`, never upload those).

## 2. Build an AAB

```bash
export API_BASE_URL="https://api.deliveryos.example.com/api/v1"
export GOOGLE_MAPS_API_KEY="AIza..."            # customer app
export FIREBASE_API_KEY="..." FIREBASE_APP_ID="..." FIREBASE_SENDER_ID="..." FIREBASE_PROJECT_ID="..."
export SENTRY_DSN="https://..."                 # optional

./scripts/build-android.sh customer   # or: rider
```

Output: `apps/<app>/build/app/outputs/bundle/release/app-release.aab`.

## 3. Verify before upload

- `aapt` / `bundletool dump manifest`: versionCode/versionName bumped in `pubspec.yaml` (`version: 1.0.0+1` → `+2`, etc.).
- Signed with the release key: `jarsigner -verify -certs -verbose app-release.aab | head`.
- Launch on a device from the AAB (bundletool `build-apks --connected-device`): branded icon + colored splash, maps render (customer), push permission prompt appears.

## 4. Play Console checklist

- **Data safety**: declare location collection (rider foreground-service GPS, used for delivery dispatch), account/phone data (OTP auth). Background-location permission is used only while the rider is online.
- **Foreground service disclosure**: rider app runs a location foreground service during active duty — declare the type (`location`) and show the in-app disclosure before the first duty toggle.
- The platform runs **two environments only**: dev (local Docker) and production. There is no staging server — validate release candidates locally against the dev stack (`docker compose up`) or a device pointed at the dev machine's LAN IP, and treat the Play internal testing track as the final pre-production gate with the production API.

## 5. iOS

The iOS Runner projects exist; App Store release requires signing certificates, an Apple Developer account, and `flutter build ipa`. Not configured in this repo yet — track separately.
