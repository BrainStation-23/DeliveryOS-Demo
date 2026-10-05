import 'package:customer_app/core/network/dio_client.dart';
export 'package:customer_app/features/auth/providers/auth_provider.dart' show dioClientProvider;

DioClient createTestMockDioClient() {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final path = options.path;

        if (path.contains('/auth/otp/verify')) {
          final data = options.data is Map ? options.data as Map : {};
          final otp = data['otp']?.toString();
          final phone = data['phone']?.toString() ?? '+8801700000005';
          if (otp == '123456') {
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'status': 'success',
                  'data': {
                    'accessToken': 'test-access-token-jwt',
                    'user': {
                      'id': 'user-test-id',
                      'phone': phone,
                      'name': 'Test User',
                      'role': 'CUSTOMER',
                    },
                  },
                },
              ),
            );
          }
          return handler.reject(
            DioException(
              requestOptions: options,
              response: Response(
                requestOptions: options,
                statusCode: 400,
                data: {'message': 'Invalid OTP'},
              ),
            ),
          );
        }

        if (path.contains('/coupons/validate') || path.contains('/promotions/validate-coupon')) {
          final data = options.data is Map ? options.data as Map : {};
          final code = data['code']?.toString();
          if (code == 'WELCOME50') {
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'status': 'success',
                  'data': {
                    'isValid': true,
                    'discountAmount': 50.0,
                    'discount': 50.0,
                    'discountType': 'FLAT',
                    'code': 'WELCOME50',
                  },
                },
              ),
            );
          }
          return handler.reject(
            DioException(
              requestOptions: options,
              response: Response(
                requestOptions: options,
                statusCode: 400,
                data: {'message': 'Invalid coupon'},
              ),
            ),
          );
        }

        if (path.contains('/orders/validate-reorder') || path.contains('/reorder-check')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'isStoreOperational': true,
                  'hasStockChanges': false,
                  'validItems': [],
                  'unavailableItems': [],
                },
              },
            ),
          );
        }

        if (path.contains('/geo/reverse-geocode')) {
          final lat = (options.queryParameters['lat'] as num?)?.toDouble() ?? 0.0;
          String address = 'Banani Road 11, Dhaka';
          if ((lat - 23.7780).abs() < 0.01) {
            address = 'Gulshan 1 Circle, Avenue 1, Dhaka';
          } else if ((lat - 23.7465).abs() < 0.01) {
            address = 'Road 27, Dhanmondi, Dhaka';
          }
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'addressLine': address,
                  'displayName': address,
                },
              },
            ),
          );
        }

        if (path.contains('/banners')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': [
                  {
                    'id': 'b-101',
                    'title': '50% OFF Biryani Feast',
                    'subtitle': "Valid on Sultan's Dine & Kacchi Bhai",
                    'imageUrl': 'https://example.com/banner.jpg',
                    'actionType': 'OUTLET',
                    'actionValue': 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
                  },
                ],
              },
            ),
          );
        }

        if (path.contains('/vendors/nearby')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': [
                  {
                    'id': 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
                    'name': "Sultan's Dine - Banani",
                    'type': 'RESTAURANT',
                    'rating': 4.8,
                    'ratingCount': 1240,
                    'deliveryTimeMinutes': 35,
                    'distanceKm': 1.2,
                    'cuisineTypes': ['Biryani', 'Mughlai'],
                    'priceLevel': 'PREMIUM',
                    'isPromoted': true,
                    'isOperational': true,
                    'isBusy': false,
                  },
                  {
                    'id': 'vendor-kacchi-1',
                    'name': 'Kacchi Bhai - Gulshan 1',
                    'type': 'RESTAURANT',
                    'rating': 4.6,
                    'deliveryTimeMinutes': 25,
                    'distanceKm': 2.1,
                    'cuisineTypes': ['Kacchi', 'Polao'],
                    'isOperational': true,
                    'isBusy': false,
                  },
                  {
                    'id': 'vendor-shwapno-1',
                    'name': 'Shwapno Superstore Express',
                    'type': 'SUPER_SHOP',
                    'rating': 4.7,
                    'deliveryTimeMinutes': 20,
                    'distanceKm': 0.8,
                    'cuisineTypes': ['Groceries', 'Daily Needs'],
                    'isOperational': true,
                    'isBusy': false,
                  },
                ],
              },
            ),
          );
        }

        if (path.contains('/vendors/search')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'outlets': [
                    {
                      'id': 'vendor-kacchi-1',
                      'name': 'Kacchi Bhai - Gulshan 1',
                      'type': 'RESTAURANT',
                      'rating': 4.8,
                      'deliveryTime': '30-40 min',
                      'distanceKm': 1.4,
                      'isOperational': true,
                      'isOpen': true,
                    },
                  ],
                  'items': [
                    {
                      'id': 'item-kb-01',
                      'vendorId': 'vendor-kacchi-1',
                      'vendorName': 'Kacchi Bhai - Gulshan 1',
                      'name': 'Kacchi Biryani with Borhani',
                      'price': 420.0,
                      'category': 'Platters',
                      'isAvailable': true,
                    },
                  ],
                },
              },
            ),
          );
        }

        if (path.contains('/catalog')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'id': 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
                  'name': "Sultan's Dine - Banani",
                  'isOperational': true,
                  'isBusy': false,
                  'operatingHours': '11:00 AM - 11:30 PM',
                  'address': 'Road 11, Banani, Dhaka',
                  'categories': [
                    {
                      'id': 'cat-1',
                      'name': 'Shahi Kacchi',
                      'items': [
                        {
                          'id': 'prod-1',
                          'name': 'Kacchi Biryani (Basmati)',
                          'description': 'Traditional Dhaka style mutton kacchi',
                          'basePrice': 450.0,
                          'unitType': 'portion',
                          'isInStock': true,
                          'variants': [],
                        },
                        {
                          'id': 'prod-2',
                          'name': 'Shahi Chicken Roast with Polao',
                          'description': 'Tender roasted chicken with fragrant chinigura polao',
                          'basePrice': 320.0,
                          'unitType': 'portion',
                          'isInStock': false,
                          'variants': [],
                        },
                      ],
                    },
                    {
                      'id': 'cat-2',
                      'name': 'Kebabs & Sides',
                      'items': [
                        {
                          'id': 'prod-3',
                          'name': 'Reshmi Kebab',
                          'description': 'Melt in mouth skewered chicken',
                          'basePrice': 220.0,
                          'unitType': 'pc',
                          'isInStock': true,
                          'variants': [],
                        },
                      ],
                    },
                  ],
                },
              },
            ),
          );
        }

        if (path.contains('/orders/history')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': [
                  {
                    'id': 'ord-hist-1',
                    'orderNumber': 'ORD-9842',
                    'createdAt': '2026-09-24T12:00:00Z',
                    'totalAmount': 520.0,
                    'status': 'DISPATCHED',
                    'vendor': {
                      'id': 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
                      'name': "Sultan's Dine - Banani",
                      'type': 'RESTAURANT',
                    },
                    'items': [
                      {
                        'id': 'item-h-1',
                        'productName': 'Kacchi Biryani (Basmati)',
                        'quantity': 1,
                        'totalPrice': 450.0,
                      }
                    ],
                  }
                ],
              },
            ),
          );
        }

        if (path.contains('/orders')) {
          final isCancelTest = path.contains('cancel');
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'id': 'ord-123',
                  'orderNumber': 'ORD-1234',
                  'status': isCancelTest ? 'PLACED' : 'DISPATCHED',
                  'totalAmount': 520.0,
                  'vendor': {
                    'id': 'b8b33bf6-6b22-4bb3-9d41-e9fb94c25601',
                    'name': "Sultan's Dine - Banani",
                    'addressText': 'Road 11, Banani, Dhaka',
                    'phone': '+8801711111111',
                    'latitude': 23.7937,
                    'longitude': 90.4066,
                  },
                  'rider': {
                    'id': 'rider-01',
                    'user': {
                      'fullName': 'Karim Hossain',
                      'phone': '+8801700000002',
                    },
                  },
                  'orderItems': [
                    {
                      'id': 'item-1',
                      'productName': 'Kacchi Biryani',
                      'quantity': 1,
                      'totalPrice': 450.0,
                    },
                  ],
                },
              },
            ),
          );
        }

        if (path.contains('/payments/status')) {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'status': 'success',
                'data': {
                  'status': 'PAID',
                  'paymentStatus': 'PAID',
                },
              },
            ),
          );
        }

        return handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {'status': 'success', 'data': {}},
          ),
        );
      },
    ),
  );

  return DioClient(dio: dio);
}
