import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/features/auth/domain/auth_models.dart';
import 'package:rider_app/features/auth/presentation/pending_approval_screen.dart';
import 'package:rider_app/features/auth/presentation/phone_login_screen.dart';
import 'package:rider_app/features/auth/providers/auth_provider.dart';
import 'package:rider_app/features/dashboard/domain/duty_models.dart';
import 'package:rider_app/features/dashboard/presentation/rider_dashboard_screen.dart';
import 'package:rider_app/features/dashboard/providers/duty_provider.dart';

import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  Widget createTestWidget({required Widget child, ProviderContainer? container}) {
    return UncontrolledProviderScope(
      container: container ?? createMockRiderContainer(storage: storage),
      child: MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        home: child,
      ),
    );
  }

  group('Auth & Duty Domain Invariants', () {
    test('VehicleType enum maps to correct API keys and display names', () {
      expect(VehicleType.motorcycle.apiKey, 'motorcycle');
      expect(VehicleType.bicycle.apiKey, 'bicycle');
      expect(VehicleType.car.apiKey, 'car');

      expect(VehicleTypeExtension.fromString('bicycle'), VehicleType.bicycle);
      expect(VehicleTypeExtension.fromString('car'), VehicleType.car);
      expect(VehicleTypeExtension.fromString('unknown'), VehicleType.motorcycle);
    });

    test('AccountStatus correctly differentiates approved from pending and suspended', () {
      expect(AccountStatus.active.apiKey, 'ACTIVE');
      expect(AccountStatus.pendingApproval.apiKey, 'PENDING_APPROVAL');
      expect(AccountStatus.suspended.apiKey, 'SUSPENDED');

      expect(AccountStatusExtension.fromString('ACTIVE'), AccountStatus.active);
      expect(AccountStatusExtension.fromString('PENDING_APPROVAL'), AccountStatus.pendingApproval);
      expect(AccountStatusExtension.fromString(null), AccountStatus.pendingApproval);
    });

    test('INVARIANT: Unapproved rider account (PENDING_APPROVAL) is strictly prevented from toggling online', () async {
      final container = createMockRiderContainer(storage: storage);

      // Initialize auth with pending profile
      final pendingProfile = RiderProfileData.pilotPending(
        phone: '+8801700998877',
        fullName: 'Shafiqul Islam',
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: false,
        isPendingApproval: true,
        profile: pendingProfile,
      );

      final dutyNotifier = container.read(riderDutyProvider.notifier);

      // Attempt to toggle online
      final success = await dutyNotifier.toggleDuty(forceState: true);

      expect(success, isFalse);
      final dutyState = container.read(riderDutyProvider);
      expect(dutyState.isOnline, isFalse);
      expect(dutyState.isBeaconing, isFalse);
      expect(dutyState.error, contains('locked until administrator approval'));
      expect(dutyState.statusMessage, contains('Locked'));

      dutyNotifier.stopBeaconing();
    });

    test('Approved rider account toggles online and offline successfully with GPS beaconing', () async {
      final container = createMockRiderContainer(storage: storage);

      // Initialize auth with approved profile
      final approvedProfile = RiderProfileData.pilotApproved(
        phone: '+8801700112233',
        fullName: 'Tanvir Hossain',
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: true,
        isPendingApproval: false,
        profile: approvedProfile,
      );

      final dutyNotifier = container.read(riderDutyProvider.notifier);

      // 1. Toggle Online
      final onlineSuccess = await dutyNotifier.toggleDuty(forceState: true);
      expect(onlineSuccess, isTrue);

      final onlineState = container.read(riderDutyProvider);
      expect(onlineState.isOnline, isTrue);
      expect(onlineState.isBeaconing, isTrue);
      expect(onlineState.statusMessage, contains('Online'));

      // 2. Toggle Offline
      final offlineSuccess = await dutyNotifier.toggleDuty(forceState: false);
      expect(offlineSuccess, isTrue);

      final offlineState = container.read(riderDutyProvider);
      expect(offlineState.isOnline, isFalse);
      expect(offlineState.isBeaconing, isFalse);
      expect(offlineState.speed, 0.0);
      expect(offlineState.statusMessage, contains('Offline'));

      dutyNotifier.stopBeaconing();
    });

    test('COD cash safety limit calculation is accurate', () {
      final safeDuty = RiderDutyState(
        codCashInHand: 1500.0,
        cashSafetyLimit: 5000.0,
      );
      expect(safeDuty.canAcceptCodTrips, isTrue);
      expect(safeDuty.isCashLimitReached, isFalse);

      final limitReachedDuty = RiderDutyState(
        codCashInHand: 5000.0,
        cashSafetyLimit: 5000.0,
      );
      expect(limitReachedDuty.canAcceptCodTrips, isFalse);
      expect(limitReachedDuty.isCashLimitReached, isTrue);
    });
  });

  group('Auth & Duty UI & Widgets', () {
    testWidgets('PhoneLoginScreen renders vehicle options and input elements', (tester) async {
      await tester.pumpWidget(
        createTestWidget(child: const PhoneLoginScreen()),
      );
      await tester.pumpAndSettle();

      expect(find.text('DeliveryOS Rider Fleet'), findsOneWidget);
      expect(find.text('Rider Login'), findsOneWidget);
      expect(find.text('Apply / Register'), findsOneWidget);
      expect(find.text('MOBILE NUMBER'), findsOneWidget);
      expect(find.text('Send Verification OTP'), findsOneWidget);

      // Switch to Register tab
      await tester.tap(find.text('Apply / Register'));
      await tester.pumpAndSettle();

      expect(find.text('FULL NAME'), findsOneWidget);
      expect(find.text('VEHICLE TYPE'), findsOneWidget);
      expect(find.text('Motorcycle'), findsOneWidget);
      expect(find.text('Bicycle'), findsOneWidget);
      expect(find.text('Car'), findsOneWidget);
    });

    testWidgets('PendingApprovalScreen renders pending status and lock explanation', (tester) async {
      final container = createMockRiderContainer(storage: storage);
      final pendingProfile = RiderProfileData.pilotPending(
        phone: '+8801700998877',
        fullName: 'Shafiqul Islam',
        vehicleType: VehicleType.motorcycle,
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: false,
        isPendingApproval: true,
        profile: pendingProfile,
      );

      await tester.pumpWidget(
        createTestWidget(container: container, child: const PendingApprovalScreen()),
      );
      await tester.pumpAndSettle();

      expect(find.text('Account Pending Approval'), findsOneWidget);
      expect(find.text('STATUS: PENDING_APPROVAL'), findsOneWidget);
      expect(find.text('Shafiqul Islam'), findsOneWidget);
      expect(find.text('+8801700998877'), findsOneWidget);
      expect(find.text('Check Approval Status'), findsOneWidget);
      expect(find.textContaining('Duty Switch is locked until account approval'), findsOneWidget);
    });

    testWidgets('RiderDashboardScreen renders sunlight-readable duty switch and radar', (tester) async {
      final container = createMockRiderContainer(storage: storage);
      final approvedProfile = RiderProfileData.pilotApproved(
        phone: '+8801700112233',
        fullName: 'Tanvir Hossain',
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: true,
        isPendingApproval: false,
        profile: approvedProfile,
      );

      await tester.pumpWidget(
        createTestWidget(container: container, child: const RiderDashboardScreen()),
      );
      await tester.pumpAndSettle();

      expect(find.text('Tanvir Hossain'), findsOneWidget);
      expect(find.text('YOU ARE OFFLINE'), findsOneWidget);
      expect(find.text('GO ONLINE (START SHIFT)'), findsOneWidget);
      expect(find.text('GPS LOCATION RADAR'), findsOneWidget);
      expect(find.text('Completed Trips'), findsOneWidget);
      expect(find.text('Earned Payout'), findsOneWidget);
      expect(find.text('COD Cash in Hand'), findsOneWidget);

      container.read(riderDutyProvider.notifier).stopBeaconing();
    });
  });
}
