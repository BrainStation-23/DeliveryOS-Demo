import { PaymentStatus } from '@prisma/client';

export interface PaymentInitiationParams {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerPhone: string;
  customerName?: string;
  redirectUrl?: string;
}

export interface PaymentInitiationResult {
  paymentUrl: string;
  transactionId: string;
  sessionKey?: string;
  gateway: string;
}

export interface WebhookValidationResult {
  isValid: boolean;
  transactionId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  rawResponse: Record<string, unknown>;
}

export interface RefundParams {
  transactionId: string;
  bankTranId?: string | null;
  amount: number;
  remarks?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string | null;
  raw: Record<string, unknown>;
}

export interface IPaymentGateway {
  readonly name: string;
  initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult>;
  verifyWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookValidationResult>;
  queryTransaction(transactionId: string): Promise<PaymentStatus>;
  refund(params: RefundParams): Promise<RefundResult>;
}
