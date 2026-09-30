import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rider_app/core/storage/local_storage.dart';
import 'package:rider_app/main.dart';

void main() {
  Future<LocalStorage> seedStorage() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    return LocalStorage(prefs);
  }

  testWidgets('DeliveryOSRiderApp smoke test', (WidgetTester tester) async {
    final localStorage = await seedStorage();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          localStorageProvider.overrideWithValue(localStorage),
        ],
        child: const DeliveryOSRiderApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('DeliveryOS Rider Fleet'), findsOneWidget);
  });

  testWidgets('app entry renders brand header and phone input without overflow',
      (WidgetTester tester) async {
    final localStorage = await seedStorage();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          localStorageProvider.overrideWithValue(localStorage),
        ],
        child: const DeliveryOSRiderApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('DeliveryOS Rider Fleet'), findsOneWidget);
  });
}
