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

@Injectable()
export class SandboxGatewayAdapter implements IPaymentGateway {
  readonly name = 'SANDBOX';
  private readonly logger = new Logger(SandboxGatewayAdapter.name);

  static readonly TEST_SECRET = 'deliveryos-sandbox-secret-key-2026';

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    const transactionId = `SND-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const sessionKey = `snd_sess_${crypto.randomBytes(16).toString('hex')}`;

    this.logger.log(
      `[SANDBOX] Initiating payment for Order ${params.orderNumber} (Amount: ${params.amount} ${params.currency})`,
    );

    const paymentUrl = `https://sandbox.deliveryos.local/checkout/${transactionId}?orderId=${params.orderId}&amount=${params.amount}`;

    return {
      paymentUrl,
      transactionId,
      sessionKey,
      gateway: this.name,
    };
  }

  async verifyWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookValidationResult> {
    const signature = headers['x-deliveryos-signature'] || (payload['signature'] as string) || '';
    const transactionId = (payload['transactionId'] as string) || '';
    const orderId = (payload['orderId'] as string) || '';
    const amount = Number(payload['amount']) || 0;
    const testStatus = (payload['status'] as string) || 'PAID';

    // Calculate HMAC
    const expected = crypto
      .createHmac('sha256', SandboxGatewayAdapter.TEST_SECRET)
      .update(`${transactionId}:${orderId}:${amount}:${testStatus}`)
      .digest('hex');

    const isValid = signature === expected;
    const status: PaymentStatus =
      isValid && (testStatus === 'PAID' || testStatus === 'SUCCESS') ? PaymentStatus.PAID : PaymentStatus.FAILED;

    return {
      isValid,
      transactionId,
      orderId,
      amount,
      status,
      rawResponse: payload,
    };
  }

  async queryTransaction(transactionId: string): Promise<PaymentStatus> {
    this.logger.log(`[SANDBOX] Querying status for ${transactionId}`);
    return PaymentStatus.PAID;
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const refundId = `SND-REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    this.logger.log(`[SANDBOX] Simulated refund of ${params.amount} for Trx ${params.transactionId} (Ref: ${refundId})`);
    return { success: true, refundId, raw: { simulated: true, refund_ref_id: refundId } };
  }
}

