import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/providers/auth_provider.dart';

enum PaymentWebViewResult { paid, failed, cancelled }

/// Hosts the SSLCommerz payment page and polls the payment status endpoint
/// until the transaction settles or the user closes the sheet.
class PaymentWebViewScreen extends ConsumerStatefulWidget {
  const PaymentWebViewScreen({
    super.key,
    required this.paymentUrl,
    required this.transactionId,
    this.dioClient,
  });

  final String paymentUrl;
  final String transactionId;
  final DioClient? dioClient;

  static Future<PaymentWebViewResult> launch(
    BuildContext context, {
    required String paymentUrl,
    required String transactionId,
    DioClient? dioClient,
  }) {
    return Navigator.of(context).push<PaymentWebViewResult>(
      MaterialPageRoute(
        builder: (_) => PaymentWebViewScreen(
          paymentUrl: paymentUrl,
          transactionId: transactionId,
          dioClient: dioClient,
        ),
      ),
    ).then((result) => result ?? PaymentWebViewResult.cancelled);
  }

  @override
  ConsumerState<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends ConsumerState<PaymentWebViewScreen> {
  late final WebViewController _controller;
  Timer? _pollTimer;
  bool _settled = false;
  int _pollCount = 0;
  static const int _maxPolls = 300; // 15 minutes max at 3s intervals

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            // Callback URLs carry the gateway verdict; poll rather than render them
            if (request.url.contains('/payments/callback/') ||
                request.url.contains('/payments/webhook/')) {
              _checkStatusOnce();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.paymentUrl));

    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _checkStatusOnce());
  }

  Future<void> _checkStatusOnce() async {
    if (_settled || !mounted) return;
    _pollCount++;
    if (_pollCount > _maxPolls) {
      _pollTimer?.cancel();
      _settle(PaymentWebViewResult.failed);
      return;
    }

    try {
      final DioClient client = widget.dioClient ?? ref.read(dioClientProvider);
      final response = await client.get(
        '${ApiConstants.paymentStatus}/${widget.transactionId}',
      );
      final data = response.data is Map ? (response.data['data'] as Map<String, dynamic>?) : null;
      final status = (data?['status'] ?? data?['paymentStatus'])?.toString().toUpperCase();
      if (status == 'PAID') {
        _settle(PaymentWebViewResult.paid);
      } else if (status == 'FAILED' || status == 'REFUNDED') {
        _settle(PaymentWebViewResult.failed);
      }
    } catch (_) {
      // Transient network errors: keep polling until the timer/window ends
    }
  }

  void _settle(PaymentWebViewResult result) {
    if (_settled) return;
    _settled = true;
    _pollTimer?.cancel();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result == PaymentWebViewResult.paid
                ? 'Payment successful! Your order is being confirmed.'
                : 'Payment did not complete. You can retry from order history.',
          ),
        ),
      );
      Navigator.of(context).pop(result);
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete Payment'),
        actions: [
          TextButton(
            onPressed: () {
              _pollTimer?.cancel();
              Navigator.of(context).pop(PaymentWebViewResult.cancelled);
            },
            child: const Text('Cancel'),
          ),
        ],
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
