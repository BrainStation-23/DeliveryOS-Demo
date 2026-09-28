import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentInitiationParams,
  PaymentInitiationResult,
  RefundParams,
  RefundResult,
  WebhookValidationResult,
} from '../interfaces/payment-gateway.interface';

/**
 * SSLCommerz (Session/Validator API v4) — real integration.
 *
 * Requires: SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD, and (for live mode)
 * SSLCOMMERZ_BASE_URL defaulting to the sandbox endpoint. Callbacks need a
 * publicly reachable base via SSLCOMMERZ_CALLBACK_BASE (e.g. https://api.domain).
 *
 * Verification is server-to-server: IPN payloads carry val_id/tran_id which are
 * re-checked against the SSLCommerz validator APIs before any order is marked
 * PAID (fail-closed — no credential, no verification).
 */
@Injectable()
export class SslCommerzGatewayAdapter implements IPaymentGateway {
  readonly name = 'SSLCOMMERZ';
  private readonly logger = new Logger(SslCommerzGatewayAdapter.name);

  private get storeId(): string | undefined {
    return process.env.SSLCOMMERZ_STORE_ID;
  }
  private get storePassword(): string | undefined {
    return process.env.SSLCOMMERZ_STORE_PASSWORD;
  }
  private get baseUrl(): string {
    return process.env.SSLCOMMERZ_BASE_URL || 'https://sandbox.sslcommerz.com';
  }
  private get callbackBase(): string {
    return process.env.SSLCOMMERZ_CALLBACK_BASE || 'http://localhost:4000';
  }
  private get isConfigured(): boolean {
    return Boolean(this.storeId && this.storePassword);
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    if (!this.isConfigured) {
      throw new Error('SSLCOMMERZ gateway is not configured: SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD are required');
    }

    const transactionId = `SSLC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const form = new URLSearchParams({
      store_id: this.storeId!,
      store_passwd: this.storePassword!,
      total_amount: params.amount.toFixed(2),
      currency: params.currency,
      tran_id: transactionId,
      success_url: `${this.callbackBase}/api/v1/payments/callback/${this.name}?tran_id=${transactionId}`,
      fail_url: `${this.callbackBase}/api/v1/payments/callback/${this.name}?tran_id=${transactionId}`,
      cancel_url: `${this.callbackBase}/api/v1/payments/callback/${this.name}?tran_id=${transactionId}`,
      ipn_url: `${this.callbackBase}/api/v1/payments/webhook/${this.name}`,
      shipping_method: 'NO',
      product_name: `DeliveryOS Order ${params.orderNumber}`,
      product_category: 'General',
      product_profile: 'general',
      cus_name: params.customerName || 'Valued Customer',
      cus_phone: params.customerPhone,
      cus_add1: 'N/A',
      cus_city: 'N/A',
      cus_country: 'Bangladesh',
      emi_option: '0',
    });

    const response = await fetch(`${this.baseUrl}/validator/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const payload = (await response.json()) as {
      status?: string;
      GatewayPageURL?: string;
      sessionkey?: string;
      failedreason?: string;
    };

    if (!response.ok || payload.status !== 'VALID' || !payload.GatewayPageURL) {
      this.logger.error(
        `SSLCommerz session create failed (${response.status}): ${payload.failedreason || 'unknown error'}`,
      );
      throw new Error(`SSLCommerz session creation failed: ${payload.failedreason || `HTTP ${response.status}`}`);
    }

    this.logger.log(`SSLCommerz session created for Order ${params.orderNumber} (Trx: ${transactionId})`);

    return {
      paymentUrl: payload.GatewayPageURL,
      transactionId,
      sessionKey: payload.sessionkey,
      gateway: this.name,
    };
  }

  async verifyWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookValidationResult> {
    const transactionId =
      (payload['tran_id'] as string) || (payload['transactionId'] as string) || headers['x-transaction-id'] || '';
    const valId = (payload['val_id'] as string) || '';
    const orderId = (payload['value_a'] as string) || (payload['orderId'] as string) || '';

    const validation = await this.validateWithSslCommerz({ tranId: transactionId, valId });
    const isSuccess = validation.status === 'VALID' || validation.status === 'VALIDATED';

    return {
      isValid: isSuccess,
      transactionId: transactionId || validation.tranId,
      orderId,
      amount: validation.amount,
      status: isSuccess ? PaymentStatus.PAID : PaymentStatus.FAILED,
      rawResponse: validation.raw,
    };
  }

  async queryTransaction(transactionId: string): Promise<PaymentStatus> {
    const validation = await this.validateWithSslCommerz({ tranId: transactionId });
    return validation.status === 'VALID' || validation.status === 'VALIDATED'
      ? PaymentStatus.PAID
      : PaymentStatus.FAILED;
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (!this.isConfigured) {
      return { success: false, refundId: null, raw: { error: 'SSLCOMMERZ gateway is not configured' } };
    }
    if (!params.bankTranId) {
      return { success: false, refundId: null, raw: { error: 'bank_tran_id is required for SSLCommerz refunds' } };
    }

    const form = new URLSearchParams({
      store_id: this.storeId!,
      store_passwd: this.storePassword!,
      refund_amount: params.amount.toFixed(2),
      refund_remarks: params.remarks || `DeliveryOS refund for ${params.transactionId}`,
      bank_tran_id: params.bankTranId,
      format: 'json',
    });

    const response = await fetch(`${this.baseUrl}/validator/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const payload = (await response.json()) as {
      status?: string;
      refund_ref_id?: string;
      errorReason?: string;
    };

    const success = response.ok && payload.status === 'SUCCESS';
    if (!success) {
      this.logger.error(`SSLCommerz refund failed: ${payload.errorReason || payload.status || `HTTP ${response.status}`}`);
    }
    return {
      success,
      refundId: payload.refund_ref_id || null,
      raw: payload as Record<string, unknown>,
    };
  }

  private async validateWithSslCommerz(ids: { tranId: string; valId?: string }): Promise<{
    status: string;
    amount: number;
    tranId: string;
    raw: Record<string, unknown>;
  }> {
    if (!this.isConfigured) {
      this.logger.warn('SSLCommerz validation skipped: gateway credentials are not configured (fail-closed)');
      return { status: 'UNCONFIGURED', amount: 0, tranId: ids.tranId, raw: { error: 'gateway not configured' } };
    }

    const query = new URLSearchParams({
      store_id: this.storeId!,
      store_passwd: this.storePassword!,
      format: 'json',
      ...(ids.valId ? { val_id: ids.valId } : { tran_id: ids.tranId }),
    });
    // IPN re-check uses the order-validation API; status polling uses the TrxID API
    const endpoint = ids.valId ? 'validator/api.php' : 'validator/api/merchantTransIDvalidationAPI.php';

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}?${query.toString()}`);
      const raw = (await response.json()) as Record<string, unknown>;
      return {
        status: (raw['status'] as string) || 'UNKNOWN',
        amount: Number(raw['amount']) || 0,
        tranId: (raw['tran_id'] as string) || ids.tranId,
        raw,
      };
    } catch (err) {
      this.logger.error(`SSLCommerz validation request error: ${err instanceof Error ? err.message : String(err)}`);
      return { status: 'VALIDATION_ERROR', amount: 0, tranId: ids.tranId, raw: { error: 'validation request failed' } };
    }
  }
}
