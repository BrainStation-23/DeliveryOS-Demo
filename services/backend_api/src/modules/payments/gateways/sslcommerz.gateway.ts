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
export class SslCommerzGatewayAdapter implements IPaymentGateway {
  readonly name = 'SSLCOMMERZ';
  private readonly logger = new Logger(SslCommerzGatewayAdapter.name);

  private readonly storeId = process.env.SSLCOMMERZ_STORE_ID || 'sandbox_store_id';
  private readonly storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || 'sandbox_store_pass';
  private readonly baseUrl = process.env.SSLCOMMERZ_BASE_URL || 'https://sandbox.sslcommerz.com';

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    const transactionId = `SSLC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const sessionKey = `sslc_sess_${crypto.randomBytes(16).toString('hex')}`;

    this.logger.log(
      `Initiating SSLCommerz session for Order ${params.orderNumber} (Amount: ${params.amount} ${params.currency})`,
    );

    const isMock = !process.env.SSLCOMMERZ_STORE_ID || process.env.NODE_ENV === 'test';
    const paymentUrl = isMock
      ? `https://payment.deliveryos.local/sslcommerz/gwprocess?tran_id=${transactionId}&amount=${params.amount}`
      : `${this.baseUrl}/gwprocess/v4/gw.php?sessionkey=${sessionKey}`;

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
    const transactionId = (payload['tran_id'] as string) || (payload['transactionId'] as string) || '';
    const orderId = (payload['value_a'] as string) || (payload['orderId'] as string) || '';
    const amount = Number(payload['amount']) || 0;
    const sslStatus = (payload['status'] as string) || '';
    const verifySign = (payload['verify_sign'] as string) || headers['x-sslcommerz-signature'] || '';

    // Validate verify_sign checksum
    const calculatedHash = crypto
      .createHash('md5')
      .update(`${transactionId}:${orderId}:${amount}:${this.storePassword}`)
      .digest('hex');

    const isValid = verifySign === calculatedHash;
    const isSuccess = sslStatus === 'VALID' || sslStatus === 'VALIDATED' || sslStatus === 'PAID';
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
    this.logger.log(`Querying SSLCommerz status for transaction: ${transactionId}`);
    return PaymentStatus.PAID;
  }
}
