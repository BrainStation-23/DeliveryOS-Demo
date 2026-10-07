import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rider_app/core/network/dio_client.dart';
import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/features/auth/domain/auth_models.dart';
import 'package:rider_app/features/auth/providers/auth_provider.dart';
import 'package:rider_app/features/dashboard/providers/duty_provider.dart';
import 'package:rider_app/features/earnings/domain/earnings_models.dart';

import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  final summaryPayload = <String, dynamic>{
    'message': 'ok',
    'data': {
      'today': {'earnings': 350.25, 'trips': 4, 'codCollected': 1200.5},
      'week': {
        'from': '2026-10-01T00:00:00+06:00',
        'to': '2026-10-07T23:59:59+06:00',
        'earnings': 4200.5,
        'trips': 18,
        'codCollected': 15600.75,
      },
    },
  };

  group('RiderEarningsSummary domain model', () {
    test('fromJson maps today and trailing-week windows from the server payload', () {
      final summary = RiderEarningsSummary.fromJson(
        summaryPayload['data'] as Map<String, dynamic>,
      );

      expect(summary.today.earnings, 350.25);
      expect(summary.today.trips, 4);
      expect(summary.today.codCollected, 1200.5);
      expect(summary.today.from, isNull);
      expect(summary.today.to, isNull);

      expect(summary.week.earnings, 4200.5);
      expect(summary.week.trips, 18);
      expect(summary.week.codCollected, 15600.75);
      expect(summary.week.from, DateTime.parse('2026-10-01T00:00:00+06:00'));
      expect(summary.week.to, DateTime.parse('2026-10-07T23:59:59+06:00'));
    });

    test('fromJson falls back to zeroed windows on malformed payload', () {
      final summary = RiderEarningsSummary.fromJson(<String, dynamic>{
        'today': 'not-a-map',
        'week': null,
      });

      expect(summary.today.earnings, 0.0);
      expect(summary.today.trips, 0);
      expect(summary.week.earnings, 0.0);
      expect(summary.week.trips, 0);
      expect(summary.week.from, isNull);
    });
  });

  group('RiderDutyNotifier earnings summary fetch', () {
    test('fetchEarningsSummary maps the server response into duty state', () async {
      final container = createMockRiderContainer(
        storage: storage,
        dio: createMockDio(
          adapter: MockScriptedAdapter(
            responses: {'/rider/earnings/summary': summaryPayload},
          ),
        ),
      );
      addTearDown(container.dispose);

      await container.read(riderDutyProvider.notifier).fetchEarningsSummary();

      final state = container.read(riderDutyProvider);
      expect(state.todayEarnings, 350.25);
      expect(state.todayTrips, 4);
      expect(state.weeklyEarnings, 4200.5);
      expect(state.weeklyTrips, 18);
    });

    test('fetchEarningsSummary failure keeps last known figures and never fabricates weekly data', () async {
      final container = createMockRiderContainer(
        storage: storage,
        dio: createMockDio(
          adapter: MockScriptedAdapter(
            errors: {
              '/rider/earnings/summary': DioException(
                requestOptions: RequestOptions(path: '/rider/earnings/summary'),
                response: Response(
                  requestOptions: RequestOptions(path: '/rider/earnings/summary'),
                  statusCode: 500,
                  data: {'message': 'Internal Server Error'},
                ),
              ),
            },
          ),
        ),
      );
      addTearDown(container.dispose);

      // Optimistic overlay from one locally recorded completed trip
      container.read(riderDutyProvider.notifier).recordTripCompleted(payout: 75.0);

      await container.read(riderDutyProvider.notifier).fetchEarningsSummary();

      final state = container.read(riderDutyProvider);
      expect(state.todayEarnings, 75.0);
      expect(state.weeklyEarnings, 75.0);
      expect(state.weeklyTrips, 1);
      expect(state.error, isNull);
    });

    test('duty build seeds weekly figures at zero, never from today\'s snapshot', () async {
      final container = createMockRiderContainer(storage: storage);
      addTearDown(container.dispose);

      final approvedProfile = RiderProfileData.pilotApproved(
        phone: '+8801700112233',
        fullName: 'Tanvir Hossain',
      );
      container.read(riderAuthProvider.notifier).state = RiderAuthState(
        isAuthenticated: true,
        isPendingApproval: false,
        profile: approvedProfile,
      );

      final initialState = container.read(riderDutyProvider);
      expect(initialState.todayEarnings, approvedProfile.earningsBalance);
      expect(initialState.weeklyEarnings, 0.0);
      expect(initialState.weeklyTrips, 0);

      // Let the microtask refresh settle: the default mock carries no summary
      // payload, so weekly figures must stay at zero (not today's numbers).
      await Future<void>.delayed(const Duration(milliseconds: 50));
      final settledState = container.read(riderDutyProvider);
      expect(settledState.weeklyEarnings, 0.0);
      expect(settledState.weeklyTrips, 0);
    });
  });
}
