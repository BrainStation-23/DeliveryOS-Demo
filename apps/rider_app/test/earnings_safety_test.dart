import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rider_app/core/network/dio_client.dart';
import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/features/dashboard/domain/duty_models.dart';
import 'package:rider_app/features/dashboard/providers/duty_provider.dart';
import 'package:rider_app/features/earnings/presentation/rider_earnings_screen.dart';
import 'package:rider_app/features/trips/domain/trip_models.dart';
import 'package:rider_app/features/trips/presentation/widgets/incoming_trip_modal.dart';
import 'package:rider_app/features/trips/providers/trip_provider.dart';

class MockSuccessAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody.fromString('{"success": true}', 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;
  late Dio testDio;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
    testDio = Dio();
    testDio.httpClientAdapter = MockSuccessAdapter();
  });

  ProviderContainer createContainer() {
    return ProviderContainer(
      overrides: [
        localStorageProvider.overrideWithValue(storage),
        dioClientProvider.overrideWithValue(testDio),
      ],
    );
  }

  Widget createTestWidget({required Widget child, ProviderContainer? container}) {
    return UncontrolledProviderScope(
      container: container ?? createContainer(),
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

  group('Rider Duty & Earnings Logic', () {
    test('RiderDutyState calculates remainingCashLimit and usage ratio correctly', () {
      final state = RiderDutyState(
        codCashInHand: 2500.0,
        cashSafetyLimit: 5000.0,
      );

      expect(state.canAcceptCodTrips, isTrue);
      expect(state.isCashLimitReached, isFalse);
      expect(state.remainingCashLimit, 2500.0);
      expect(state.cashLimitUsageRatio, 0.5);
      expect(state.isNearCashLimit, isFalse);
    });

    test('RiderDutyState flags isNearCashLimit when usage >= 80%', () {
      final state = RiderDutyState(
        codCashInHand: 4200.0,
        cashSafetyLimit: 5000.0,
      );

      expect(state.canAcceptCodTrips, isTrue);
      expect(state.isCashLimitReached, isFalse);
      expect(state.remainingCashLimit, 800.0);
      expect(state.cashLimitUsageRatio, 0.84);
      expect(state.isNearCashLimit, isTrue);
    });

    test('RiderDutyState flags isCashLimitReached when codCashInHand >= cashSafetyLimit', () {
      final state = RiderDutyState(
        codCashInHand: 5000.0,
        cashSafetyLimit: 5000.0,
      );

      expect(state.canAcceptCodTrips, isFalse);
      expect(state.isCashLimitReached, isTrue);
      expect(state.remainingCashLimit, 0.0);
      expect(state.cashLimitUsageRatio, 1.0);
      expect(state.isNearCashLimit, isFalse);
    });

    test('simulateTripCompleted increments earnings and COD cash accurately', () {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(riderDutyProvider.notifier);
      final initialTrips = container.read(riderDutyProvider).todayTrips;
      final initialEarnings = container.read(riderDutyProvider).todayEarnings;
      final initialCod = container.read(riderDutyProvider).codCashInHand;

      notifier.simulateTripCompleted(
        payout: 65.0,
        codCollected: 850.0,
        tripRecord: RiderCompletedTrip(
          orderId: 'test-order-1',
          orderNumber: 'ORD-9999',
          storeName: 'Test Store',
          customerAddress: 'Gulshan 1',
          completedAt: DateTime.now(),
          payout: 65.0,
          codCollected: 850.0,
          isCod: true,
        ),
      );

      final updatedState = container.read(riderDutyProvider);
      expect(updatedState.todayTrips, initialTrips + 1);
      expect(updatedState.todayEarnings, initialEarnings + 65.0);
      expect(updatedState.codCashInHand, initialCod + 850.0);
      expect(updatedState.completedTrips.first.orderNumber, 'ORD-9999');
    });

    test('depositCashToHub decrements cashInHand and unblocks COD trips', () async {
      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(riderDutyProvider.notifier);

      // Force cash limit reached
      notifier.simulateTripCompleted(
        payout: 100.0,
        codCollected: 5000.0,
      );
      expect(container.read(riderDutyProvider).isCashLimitReached, isTrue);

      // Deposit all cash
      await notifier.depositCashToHub();

      final stateAfterDeposit = container.read(riderDutyProvider);
      expect(stateAfterDeposit.codCashInHand, 0.0);
      expect(stateAfterDeposit.isCashLimitReached, isFalse);
      expect(stateAfterDeposit.canAcceptCodTrips, isTrue);
    });
  });

  group('Safety Limit Guard: claimTrip Enforcement', () {
    test('claimTrip blocks COD orders when rider cash limit is reached', () async {
      final container = createContainer();
      addTearDown(container.dispose);

      // Push rider to limit
      container.read(riderDutyProvider.notifier).simulateTripCompleted(
            payout: 50.0,
            codCollected: 6000.0,
          );

      final codTrip = TripOrder.pilotKacchiOrder().copyWith(isCod: true);
      final success = await container.read(riderTripProvider.notifier).claimTrip(codTrip);

      expect(success, isFalse);
      expect(container.read(riderTripProvider).error, contains('COD Safety Limit Reached'));
      expect(container.read(riderTripProvider).activeTrip, isNull);
    });

    test('claimTrip permits prepaid (non-COD) orders even when cash limit is reached', () async {
      final container = createContainer();
      addTearDown(container.dispose);

      // Push rider to limit
      container.read(riderDutyProvider.notifier).simulateTripCompleted(
            payout: 50.0,
            codCollected: 6000.0,
          );

      final prepaidTrip = TripOrder.pilotKacchiOrder().copyWith(isCod: false);
      final success = await container.read(riderTripProvider.notifier).claimTrip(prepaidTrip);

      expect(success, isTrue);
      expect(container.read(riderTripProvider).activeTrip, isNotNull);
      expect(container.read(riderTripProvider).activeTrip!.isCod, isFalse);
    });
  });

  group('Rider Earnings & Safety Limit UI', () {
    testWidgets('IncomingTripModal shows lock alert and disables Accept button for COD orders when cash limit reached',
        (tester) async {
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
        ],
      );
      addTearDown(container.dispose);

      // Push rider to cash limit
      container.read(riderDutyProvider.notifier).simulateTripCompleted(
            payout: 50.0,
            codCollected: 5000.0,
          );

      final codTrip = TripOrder.pilotKacchiOrder().copyWith(isCod: true);

      await tester.pumpWidget(createTestWidget(
        child: IncomingTripModal(trip: codTrip),
        container: container,
      ));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.textContaining('COD Safety Limit Reached'), findsOneWidget);
      expect(find.text('COD LIMIT REACHED'), findsOneWidget);

      // Tap Accept button - should be disabled
      await tester.tap(find.text('COD LIMIT REACHED'));
      await tester.pump();

      expect(container.read(riderTripProvider).activeTrip, isNull);

      container.read(riderDutyProvider.notifier).stopBeaconing();
    });

    testWidgets('RiderEarningsScreen renders earnings, COD meter, and allows time switching',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final container = createContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(createTestWidget(
        child: const RiderEarningsScreen(),
        container: container,
      ));
      await tester.pump(const Duration(milliseconds: 100));

      // Verify Header and cards
      expect(find.text('Earnings & COD Wallet'), findsOneWidget);
      expect(find.text('TOTAL EARNINGS'), findsOneWidget);
      expect(find.text('COD Cash in Hand'), findsOneWidget);
      expect(find.text('DEPOSIT CASH AT HUB'), findsOneWidget);

      // Switch to 'This Week'
      await tester.tap(find.text('This Week'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('THIS WEEK\'S COMPLETED TRIPS'), findsOneWidget);

      // Collect COD cash so deposit button becomes enabled
      container.read(riderDutyProvider.notifier).simulateTripCompleted(
            payout: 60.0,
            codCollected: 1200.0,
          );
      await tester.pump(const Duration(milliseconds: 100));

      // Open Deposit Cash Sheet
      await tester.tap(find.text('DEPOSIT CASH AT HUB'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Hub Cash Settlement'), findsOneWidget);
      final depositButton = find.textContaining('CONFIRM FULL DEPOSIT');
      expect(depositButton, findsOneWidget);
      await tester.ensureVisible(depositButton);
      await tester.pump();

      // Confirm deposit
      await tester.tap(depositButton);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // Check balance is reset to 0
      expect(container.read(riderDutyProvider).codCashInHand, 0.0);

      container.read(riderDutyProvider.notifier).stopBeaconing();
    });
  });
}
