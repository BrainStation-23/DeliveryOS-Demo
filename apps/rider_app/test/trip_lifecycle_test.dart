import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rider_app/core/network/dio_client.dart';
import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/core/utils/native_launcher.dart';
import 'package:rider_app/features/dashboard/providers/duty_provider.dart';
import 'package:rider_app/features/trips/domain/trip_models.dart';
import 'package:rider_app/features/trips/presentation/active_trip_screen.dart';
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

  group('Trip Lifecycle Domain & State Machine', () {
    test('TripStep provides sequential fulfillment step numbering and titles', () {
      expect(TripStep.accept.stepNumber, 0);
      expect(TripStep.pickup.stepNumber, 1);
      expect(TripStep.delivering.stepNumber, 2);
      expect(TripStep.handover.stepNumber, 3);

      expect(TripStep.pickup.stepTitle, 'Step 1: Pick Up Food');
      expect(TripStep.delivering.stepTitle, 'Step 2: Deliver to Customer');
      expect(TripStep.handover.stepTitle, 'Step 3: Complete Handover');
    });

    test('cleanPhoneNumber formats phone strings for native dialer URI', () {
      expect(cleanPhoneNumber('+880 1711-223344'), '+8801711223344');
      expect(cleanPhoneNumber('01700 11 22 33'), '01700112233');
    });

    test('Triggering broadcast alert starts 45-second countdown timer', () {
      final container = createContainer();

      final notifier = container.read(riderTripProvider.notifier);
      final testTrip = TripOrder.pilotKacchiOrder();

      notifier.triggerBroadcastAlert(testTrip);

      final state = container.read(riderTripProvider);
      expect(state.hasIncomingAlert, isTrue);
      expect(state.incomingTrip?.id, testTrip.id);
      expect(state.countdownSeconds, 45);

      notifier.stopTimer();
    });

    test('Claiming order transitions to Step 1 (Pick Up)', () async {
      final container = createContainer();

      final notifier = container.read(riderTripProvider.notifier);
      final testTrip = TripOrder.pilotKacchiOrder();

      final success = await notifier.claimTrip(testTrip);

      expect(success, isTrue);
      final state = container.read(riderTripProvider);
      expect(state.hasIncomingAlert, isFalse);
      expect(state.hasActiveTrip, isTrue);
      expect(state.activeTrip?.currentStep, TripStep.pickup);
      expect(state.activeTrip?.status, 'RIDER_ASSIGNED');

      notifier.stopTimer();
    });

    test('Confirming pickup is rejected if kitchen has not marked order READY_FOR_PICKUP', () async {
      final container = createContainer();

      final notifier = container.read(riderTripProvider.notifier);
      final testTrip = TripOrder.pilotKacchiOrder();

      await notifier.claimTrip(testTrip);
      // Order is in RIDER_ASSIGNED by default
      final pickupSuccess = await notifier.confirmPickup();

      expect(pickupSuccess, isFalse);
      expect(container.read(riderTripProvider).error, contains('not ready for pickup'));

      notifier.stopTimer();
    });

    test('Confirming pickup transitions order to DISPATCHED once kitchen marks READY_FOR_PICKUP', () async {
      final container = createContainer();

      final notifier = container.read(riderTripProvider.notifier);
      final testTrip = TripOrder.pilotKacchiOrder();

      await notifier.claimTrip(testTrip);
      notifier.updateTripStatus('READY_FOR_PICKUP');
      final pickupSuccess = await notifier.confirmPickup();

      expect(pickupSuccess, isTrue);
      final state = container.read(riderTripProvider);
      expect(state.activeTrip?.currentStep, TripStep.delivering);
      expect(state.activeTrip?.status, 'DISPATCHED');

      notifier.stopTimer();
    });

    test('COD delivery enforces cash collection verification checkbox', () async {
      final container = createContainer();

      final notifier = container.read(riderTripProvider.notifier);
      final testTrip = TripOrder.pilotKacchiOrder(isCod: true, totalAmount: 480.0, payout: 60.0);

      await notifier.claimTrip(testTrip);
      notifier.updateTripStatus('READY_FOR_PICKUP');
      await notifier.confirmPickup();
      notifier.proceedToHandover();

      // Attempt complete delivery without cash verification
      final unverifiedSuccess = await notifier.completeDelivery(
        codCashCollected: false,
        amountCollected: 480.0,
      );
      expect(unverifiedSuccess, isFalse);
      expect(container.read(riderTripProvider).error, contains('verify that cash has been collected'));

      // Complete delivery with cash verification
      final verifiedSuccess = await notifier.completeDelivery(
        codCashCollected: true,
        amountCollected: 480.0,
      );
      expect(verifiedSuccess, isTrue);

      final state = container.read(riderTripProvider);
      expect(state.hasActiveTrip, isFalse);

      // Verify wallet metrics updated
      final dutyState = container.read(riderDutyProvider);
      expect(dutyState.todayEarnings, 60.0);
      expect(dutyState.codCashInHand, 480.0);

      notifier.stopTimer();
    });
  });

  group('Trip Lifecycle UI & Widgets', () {
    testWidgets('IncomingTripModal displays payout, store, drop-off, and accept button', (tester) async {
      final container = createContainer();
      final testTrip = TripOrder.pilotKacchiOrder();

      await tester.pumpWidget(
        createTestWidget(
          container: container,
          child: IncomingTripModal(trip: testTrip),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('NEW TRIP BROADCAST'), findsOneWidget);
      expect(find.text('৳60'), findsOneWidget);
      expect(find.textContaining("Sultan's Dine"), findsOneWidget);
      expect(find.textContaining('Banani'), findsWidgets);
      expect(find.text('ACCEPT ORDER'), findsOneWidget);
      expect(find.text('Decline / Pass'), findsOneWidget);

      container.read(riderTripProvider.notifier).stopTimer();
    });

    testWidgets('ActiveTripScreen renders Step 1 (Pick Up) with Directions and Call Store', (tester) async {
      final container = createContainer();
      final testTrip = TripOrder.pilotKacchiOrder();
      await tester.runAsync(() => container.read(riderTripProvider.notifier).claimTrip(testTrip));

      await tester.pumpWidget(
        createTestWidget(
          container: container,
          child: const ActiveTripScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Pick Up'), findsOneWidget);
      expect(find.text('Directions to Store'), findsOneWidget);
      expect(find.text('Call Store'), findsOneWidget);
      expect(find.textContaining('ORDER PICKED UP'), findsOneWidget);

      container.read(riderTripProvider.notifier).stopTimer();
    });

    testWidgets('ActiveTripScreen renders Step 2 (Deliver) with Directions and Call Customer', (tester) async {
      final container = createContainer();
      final testTrip = TripOrder.pilotKacchiOrder();
      await tester.runAsync(() async {
        await container.read(riderTripProvider.notifier).claimTrip(testTrip);
        container.read(riderTripProvider.notifier).updateTripStatus('READY_FOR_PICKUP');
        await container.read(riderTripProvider.notifier).confirmPickup();
      });

      await tester.pumpWidget(
        createTestWidget(
          container: container,
          child: const ActiveTripScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Deliver'), findsOneWidget);
      expect(find.text('Directions to Customer'), findsOneWidget);
      expect(find.text('Call Customer'), findsOneWidget);
      expect(find.textContaining('ARRIVED AT DOORSTEP'), findsOneWidget);

      container.read(riderTripProvider.notifier).stopTimer();
    });

    testWidgets('ActiveTripScreen renders Step 3 (Handover) with COD verification checkbox', (tester) async {
      final container = createContainer();
      final testTrip = TripOrder.pilotKacchiOrder(isCod: true, totalAmount: 480.0);
      await tester.runAsync(() async {
        await container.read(riderTripProvider.notifier).claimTrip(testTrip);
        container.read(riderTripProvider.notifier).updateTripStatus('READY_FOR_PICKUP');
        await container.read(riderTripProvider.notifier).confirmPickup();
      });
      container.read(riderTripProvider.notifier).proceedToHandover();

      await tester.pumpWidget(
        createTestWidget(
          container: container,
          child: const ActiveTripScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('CASH ON DELIVERY'), findsOneWidget);
      expect(find.text('৳480'), findsOneWidget);
      expect(find.byType(Checkbox), findsOneWidget);
      expect(find.text('COMPLETE DELIVERY'), findsOneWidget);

      container.read(riderTripProvider.notifier).stopTimer();
    });
  });
}
