import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rider_app/core/network/dio_client.dart';
import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/features/auth/domain/auth_models.dart';
import 'package:rider_app/features/auth/presentation/phone_login_screen.dart';
import 'package:rider_app/features/auth/providers/auth_provider.dart';
import 'package:rider_app/features/dashboard/presentation/rider_dashboard_screen.dart';

import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  group('T13: Rider Session Expiry & Navigation Reset', () {
    test('Session expiry stream resets RiderAuthNotifier to unauthenticated state', () async {
      await storage.setAccessToken('valid-jwt-token');
      await storage.setRefreshToken('valid-refresh-token');
      final profile = {
        'id': 'r-1',
        'userId': 'u-1',
        'phone': '+8801700000004',
        'fullName': 'Tanvir Hasan',
        'status': 'ACTIVE',
        'vehicleType': 'motorcycle',
      };
      await storage.setRiderProfileJson(jsonEncode(profile));

      final container = createMockRiderContainer(storage: storage);
      addTearDown(container.dispose);

      // Verify initially authenticated
      final initialState = container.read(riderAuthProvider);
      expect(initialState.isAuthenticated, isTrue);

      // Trigger session expiration event
      sessionExpiredEventStream.add('Session expired. Please log in again.');
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // Assert state reset
      final updatedState = container.read(riderAuthProvider);
      expect(updatedState.isAuthenticated, isFalse);
      expect(updatedState.error, contains('Session expired'));
    });

    testWidgets('Session expiry resets initial screen navigation to PhoneLoginScreen', (tester) async {
      final container = createMockRiderContainer(storage: storage);
      addTearDown(container.dispose);

      final approvedProfile = RiderProfileData.pilotApproved(
        phone: '+8801700000004',
        fullName: 'Tanvir Hasan',
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: true,
        isPendingApproval: false,
        profile: approvedProfile,
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: Consumer(
              builder: (context, ref, _) {
                final auth = ref.watch(riderAuthProvider);
                if (auth.isAuthenticated) {
                  return const RiderDashboardScreen();
                }
                return const PhoneLoginScreen();
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.byType(RiderDashboardScreen), findsOneWidget);

      sessionExpiredEventStream.add('Unauthorized');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();

      expect(find.byType(PhoneLoginScreen), findsOneWidget);
      expect(find.byType(RiderDashboardScreen), findsNothing);
    });
  });
}
