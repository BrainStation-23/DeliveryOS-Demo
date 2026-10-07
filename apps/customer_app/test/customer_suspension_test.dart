import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/network/dio_client.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/auth/domain/user_model.dart';
import 'package:customer_app/features/auth/presentation/phone_input_screen.dart';
import 'package:customer_app/features/auth/providers/auth_provider.dart';

import 'mock_dio_client.dart';

class TestSuspendedAuthNotifier extends AuthNotifier {
  void setSuspendedError(String message, {String? reason}) {
    state = AuthState(
      status: AuthStatus.error,
      errorMessage: message,
      isSuspended: true,
      suspensionReason: reason,
    );
  }

  void setGenericError(String message) {
    state = AuthState(
      status: AuthStatus.error,
      errorMessage: message,
      isSuspended: false,
    );
  }
}

class _TestErrorHandler extends ErrorInterceptorHandler {
  DioException? lastError;
  @override
  void next(DioException err) {
    lastError = err;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Customer Account Suspension Handling', () {
    late LocalStorage storage;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      storage = LocalStorage(prefs);
    });

    test('DioClient triggers onSessionExpired and clears storage on 401 unrecoverable', () async {
      final client = DioClient(storage: storage);

      await storage.setAccessToken('valid-access-token');
      await storage.setRefreshToken('valid-refresh-token');

      String? receivedMessage;
      client.onSessionExpired((message) {
        receivedMessage = message;
      });
      final dioError = DioException(
        requestOptions: RequestOptions(
          path: '/api/v1/orders',
          extra: {'__retried_after_refresh': true},
        ),
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/orders'),
          statusCode: 401,
          data: {
            'statusCode': 401,
            'message': 'Your account has been suspended: Payment abuse. Please contact support.',
            'error': 'ACCOUNT_SUSPENDED',
            'reason': 'Payment abuse',
          },
        ),
      );

      final interceptor = client.dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final handler = _TestErrorHandler();
      interceptor.onError(dioError, handler);

      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(storage.getAccessToken(), isNull);
      expect(storage.getRefreshToken(), isNull);
      expect(receivedMessage, 'Your account has been suspended: Payment abuse. Please contact support.');
      expect(handler.lastError, isNotNull);
    });

    test('repeated AuthNotifier rebuild cycles do not accumulate session-expired listeners', () async {
      final client = createTestMockDioClient();
      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(client),
        ],
      );
      addTearDown(container.dispose);

      container.read(authProvider);
      expect(client.sessionExpiredListenerCount, 1);

      for (var i = 0; i < 5; i++) {
        container.invalidate(authProvider);
        container.read(authProvider);
        expect(client.sessionExpiredListenerCount, 1);
      }
    });

    test('AuthNotifier sendOtp sets error message and extracts suspension reason on 403', () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            return handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 403,
                  data: {
                    'statusCode': 403,
                    'message': 'Your account has been suspended: Fraudulent chargebacks. Please contact customer support.',
                    'error': 'ACCOUNT_SUSPENDED',
                    'reason': 'Fraudulent chargebacks',
                  },
                ),
              ),
            );
          },
        ),
      );
      final client = DioClient(storage: storage, dio: dio);

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          dioClientProvider.overrideWithValue(client),
        ],
      );

      final notifier = container.read(authProvider.notifier);
      final success = await notifier.sendOtp('+8801700000009');

      expect(success, isFalse);
      final state = container.read(authProvider);
      expect(state.status, AuthStatus.error);
      expect(state.isSuspended, isTrue);
      expect(state.suspensionReason, 'Fraudulent chargebacks');
      expect(state.errorMessage, contains('Fraudulent chargebacks'));
    });

    testWidgets('PhoneInputScreen renders proper AccountSuspendedCard with suspension reason', (tester) async {
      final notifier = TestSuspendedAuthNotifier();

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          authProvider.overrideWith(() => notifier),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: PhoneInputScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Initially no error or suspended view
      expect(find.byKey(const Key('account_suspended_banner')), findsNothing);

      // Trigger suspension error with custom reason
      notifier.setSuspendedError(
        'Your account has been suspended: Multiple fraudulent orders. Please contact customer support.',
        reason: 'Multiple fraudulent orders',
      );

      await tester.pumpAndSettle();

      // Dedicated proper view is rendered
      expect(find.byKey(const Key('account_suspended_banner')), findsOneWidget);
      expect(find.text('Account Suspended'), findsOneWidget);
      expect(find.text('REASON FOR SUSPENSION'), findsOneWidget);
      expect(find.text('Multiple fraudulent orders'), findsOneWidget);
      expect(find.byIcon(Icons.block_rounded), findsOneWidget);
    });

    testWidgets('PhoneInputScreen renders standard error box for non-suspension errors', (tester) async {
      final notifier = TestSuspendedAuthNotifier();

      final container = ProviderContainer(
        overrides: [
          localStorageProvider.overrideWithValue(storage),
          authProvider.overrideWith(() => notifier),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: PhoneInputScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Trigger generic error
      notifier.setGenericError('Too many attempts. Please try again later.');

      await tester.pumpAndSettle();

      // Standard error is rendered, not suspended card
      expect(find.byKey(const Key('account_suspended_banner')), findsNothing);
      expect(find.text('Too many attempts. Please try again later.'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    });
  });
}
