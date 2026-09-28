import 'dart:async';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';

enum PaymentWebViewResult { paid, failed, cancelled }

/// Hosts the SSLCommerz payment page and polls the payment status endpoint
/// until the transaction settles or the user closes the sheet.
class PaymentWebViewScreen extends StatefulWidget {
  const PaymentWebViewScreen({
    super.key,
    required this.paymentUrl,
    required this.transactionId,
  });

  final String paymentUrl;
  final String transactionId;

  static Future<PaymentWebViewResult> launch(BuildContext context, {
    required String paymentUrl,
    required String transactionId,
  }) {
    return Navigator.of(context).push<PaymentWebViewResult>(
      MaterialPageRoute(
        builder: (_) => PaymentWebViewScreen(
          paymentUrl: paymentUrl,
          transactionId: transactionId,
        ),
      ),
    ).then((result) => result ?? PaymentWebViewResult.cancelled);
  }

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  late final DioClient _dioClient;
  Timer? _pollTimer;
  bool _settled = false;

  @override
  void initState() {
    super.initState();
    _dioClient = DioClient();
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
    try {
      final response = await _dioClient.get(
        '${ApiConstants.paymentStatus}/${widget.transactionId}',
      );
      final data = response.data['data'] as Map<String, dynamic>?;
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
