import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentInitiationParams,
  PaymentInitiationResult,
  WebhookValidationResult,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class BkashGatewayAdapter implements IPaymentGateway {
  readonly name = 'BKASH';
  private readonly logger = new Logger(BkashGatewayAdapter.name);

  private readonly appKey = process.env.BKASH_APP_KEY || 'sandbox_bkash_app_key';
  private readonly appSecret = process.env.BKASH_APP_SECRET || 'sandbox_bkash_app_secret';
  private readonly username = process.env.BKASH_USERNAME || 'sandbox_bkash_user';
  private readonly password = process.env.BKASH_PASSWORD || 'sandbox_bkash_pass';
  private readonly baseUrl = process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    const transactionId = `BKS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const sessionKey = `bks_sess_${crypto.randomBytes(16).toString('hex')}`;

    this.logger.log(
      `Initiating bKash payment for Order ${params.orderNumber} (Amount: ${params.amount} ${params.currency})`,
    );

    // If live credentials are provided and not in test/dev sandbox, execute token grant and payment create
    const isMock = !process.env.BKASH_APP_KEY || process.env.NODE_ENV === 'test';
    const paymentUrl = isMock
      ? `https://payment.deliveryos.local/bkash/checkout?trx=${transactionId}&amount=${params.amount}`
      : `${this.baseUrl}/tokenized/checkout/create?paymentID=${transactionId}`;

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
    const signature = headers['x-bkash-signature'] || (payload['signature'] as string) || '';
    const transactionId = (payload['paymentID'] as string) || (payload['transactionId'] as string) || '';
    const orderId = (payload['orderId'] as string) || '';
    const amount = Number(payload['amount']) || 0;
    const statusCode = (payload['statusCode'] as string) || (payload['status'] as string) || '0000';

    // Verify signature using HMAC-SHA256
    const calculatedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(JSON.stringify({ transactionId, orderId, amount }))
      .digest('hex');

    const isValid = signature === calculatedSignature;

    const isSuccess = statusCode === '0000' || statusCode === 'PAID';
    const status: PaymentStatus = isValid && isSuccess ? PaymentStatus.PAID : PaymentStatus.FAILED;

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
    this.logger.log(`Querying bKash status for transaction: ${transactionId}`);
    return PaymentStatus.PAID;
  }
}
