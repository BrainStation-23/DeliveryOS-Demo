import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:customer_app/core/localization/app_localizations.dart';
import 'package:customer_app/core/localization/language_provider.dart';
import 'package:customer_app/core/storage/local_storage.dart';
import 'package:customer_app/features/banners/domain/banner_model.dart';
import 'package:customer_app/features/banners/presentation/banner_carousel.dart';
import 'package:customer_app/features/discovery/presentation/search_screen.dart';
import 'package:customer_app/features/store/domain/store_catalog_model.dart';
import 'package:customer_app/features/store/presentation/item_customizer_sheet.dart';
import 'package:customer_app/features/store/presentation/outlet_detail_screen.dart';
import 'mock_dio_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = LocalStorage(prefs);
  });

  Widget createTestWidget({required Widget child}) {
    return ProviderScope(
      overrides: [
        localStorageProvider.overrideWithValue(storage),
        dioClientProvider.overrideWithValue(createTestMockDioClient()),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        home: Scaffold(body: child),
      ),
    );
  }

  group('Promotional Banners & Carousel', () {
    test('BannerModel parses from JSON correctly', () {
      final json = {
        'id': 'b-101',
        'title': 'Grand Weekend Feast',
        'subtitle': 'Flat 30% OFF',
        'imageUrl': 'https://example.com/banner.jpg',
        'actionType': 'OUTLET',
        'actionValue': 'vendor-123',
      };
      final banner = BannerModel.fromJson(json);
      expect(banner.id, 'b-101');
      expect(banner.title, 'Grand Weekend Feast');
      expect(banner.actionType, 'OUTLET');
      expect(banner.actionValue, 'vendor-123');
    });

    testWidgets('BannerCarousel renders banner cards and indicator dots',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget(child: const BannerCarousel()));
      await tester.pumpAndSettle();

      expect(find.text('50% OFF Biryani Feast'), findsOneWidget);
      expect(find.text("Valid on Sultan's Dine & Kacchi Bhai"), findsOneWidget);
    });
  });

  group('Universal Search', () {
    testWidgets('SearchScreen renders query input, suggestions, and matches',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget(child: const SearchScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Popular Searches'), findsOneWidget);
      expect(find.text('Kacchi Biryani'), findsOneWidget);

      // Type "Kacchi" into search input
      await tester.enterText(find.byType(TextField), 'Kacchi');
      // Wait for debounce timer (300ms)
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();

      expect(find.textContaining('Stores & Restaurants'), findsOneWidget);
      expect(find.textContaining('Kacchi Bhai - Gulshan 1'), findsWidgets);
      expect(find.text('Kacchi Biryani with Borhani'), findsOneWidget);
    });
  });

  group('Outlet Menu & Categorized Catalog', () {
    testWidgets('OutletDetailScreen displays outlet header, category tabs, and items',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        createTestWidget(
          child: const OutletDetailScreen(vendorId: 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text("Sultan's Dine - Banani"), findsOneWidget);
      expect(find.text('OPEN NOW'), findsOneWidget);
      expect(find.text('Shahi Kacchi'), findsOneWidget);
      expect(find.text('Kebabs & Sides'), findsOneWidget);
      expect(find.text('Kacchi Biryani (Basmati)'), findsOneWidget);
      expect(find.text('ADD +'), findsOneWidget);

      // Sold-out item has Sold Out badge and UNAVAILABLE button
      expect(find.text('Shahi Chicken Roast with Polao'), findsOneWidget);
      expect(find.text('Sold Out'), findsOneWidget);
      expect(find.text('UNAVAILABLE'), findsOneWidget);
    });
  });

  group('Item Customizer Dynamic Recalculation & Sold-Out Guard', () {
    final availableProduct = ProductModel(
      id: 'prod-test-1',
      name: 'Shahi Kacchi Platter',
      description: 'Basmati rice cooked with succulent mutton',
      basePrice: 420.0,
      unitType: 'portion',
      isInStock: true,
      variants: [
        VariantModel(id: 'v-half', name: 'Half (1 pc)', price: 340.0, isInStock: true),
        VariantModel(id: 'v-full', name: 'Full (2 pcs)', price: 460.0, isInStock: true),
        VariantModel(id: 'v-out', name: 'Jumbo Platter', price: 680.0, isInStock: false),
      ],
    );

    final soldOutProduct = ProductModel(
      id: 'prod-sold-out',
      name: 'Royal Duck Roast',
      basePrice: 550.0,
      unitType: 'portion',
      isInStock: false,
    );

    testWidgets('Customizer dynamically calculates total price on variant and qty changes',
        (WidgetTester tester) async {
      double calculatedPrice = 0.0;
      int calculatedQty = 0;

      await tester.pumpWidget(
        createTestWidget(
          child: ItemCustomizerSheet(
            product: availableProduct,
            onAddToCart: ({
              required product,
              selectedVariant,
              required quantity,
              specialInstructions,
              required totalPrice,
            }) {
              calculatedPrice = totalPrice;
              calculatedQty = quantity;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Initial price with default first in-stock variant (Half: 340) and qty 1
      expect(find.descendant(of: find.byType(ElevatedButton), matching: find.text('৳340')), findsOneWidget);

      // Select Full variant (460)
      await tester.tap(find.text('Full (2 pcs)'));
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byType(ElevatedButton), matching: find.text('৳460')), findsOneWidget);

      // Increment Quantity to 2 -> 460 * 2 = 920
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byType(ElevatedButton), matching: find.text('৳920')), findsOneWidget);

      // Tap Add to Cart
      await tester.tap(find.text('Add to Cart'));
      await tester.pumpAndSettle();

      expect(calculatedPrice, 920.0);
      expect(calculatedQty, 2);
    });

    testWidgets('Sold-out guard disables CTA and displays Currently Unavailable',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        createTestWidget(
          child: ItemCustomizerSheet(product: soldOutProduct),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sold Out'), findsOneWidget);
      expect(find.text('Currently Unavailable'), findsOneWidget);

      final ctaButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(ctaButton.onPressed, isNull); // Disabled button
    });
  });
}
