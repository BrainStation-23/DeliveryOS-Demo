# Flutter R8 / ProGuard rules.
# Release builds keep minification off by default; if you enable
# `isMinifyEnabled = true`, these rules keep the reflection-based JSON
# models and the realtime/plugin layers intact.

# Flutter engine wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Google Maps / Play Services (customer app map rendering)
-dontwarn com.google.android.gms.**
-keep class com.google.android.gms.** { *; }

# background location service
-keep class com.idlutis.flutter_background_service.** { *; }
