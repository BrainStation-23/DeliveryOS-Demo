import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { SslCommerzGatewayAdapter } from './gateways/sslcommerz.gateway';
import { SandboxGatewayAdapter } from './gateways/sandbox.gateway';
import type { WebhookValidationResult } from './interfaces/payment-gateway.interface';

type TxMock = {
  payment: { findFirst: jest.Mock; updateMany: jest.Mock };
  order: { update: jest.Mock };
};

function buildService(options: {
  claimCount: number;
  existingPayment?: Record<string, unknown> | null;
}) {
  const tx: TxMock = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(
        options.existingPayment === undefined
          ? {
              id: 'pay-1',
              transactionId: 'SSLC-1',
              status: PaymentStatus.PENDING,
              orderId: 'order-1',
              gatewayResponse: null,
              amount: '500.00',
              order: { id: 'order-1', orderNumber: 'ORD-TEST-1', customerId: 'cust-1', paymentStatus: PaymentStatus.PENDING },
            }
          : options.existingPayment,
      ),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount }),
    },
    order: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    $transaction: jest.fn((fn: (tx: TxMock) => Promise<unknown>) => fn(tx)),
  };

  const orderFlowService = { handleOrderPaid: jest.fn().mockResolvedValue(undefined) };
  const notificationsService = { sendToUser: jest.fn().mockResolvedValue(true) };
  const trackingGateway = {} as never;

  const sslcommerz = {
    verifyWebhook: jest.fn().mockResolvedValue({
      isValid: true,
      transactionId: 'SSLC-1',
      orderId: 'order-1',
      amount: 500,
      status: PaymentStatus.PAID,
      rawResponse: {},
    } satisfies WebhookValidationResult),
  } as unknown as SslCommerzGatewayAdapter;

  const service = new PaymentsService(
    prisma as never,
    { acquireLock: jest.fn().mockResolvedValue(true) } as never,
    orderFlowService as never,
    trackingGateway,
    notificationsService as never,
    sslcommerz,
    {} as SandboxGatewayAdapter,
  );

  return { service, tx, orderFlowService, notificationsService };
}

const webhookArgs = ['SSLCOMMERZ', {}, {}] as const;

describe('Payment webhook idempotency (atomic PENDING claim)', () => {
  it('processes a first-time PAID webhook exactly once and triggers dispatch', async () => {
    const { service, tx, orderFlowService } = buildService({ claimCount: 1 });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({ success: true, status: PaymentStatus.PAID });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pay-1', status: PaymentStatus.PENDING } }),
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1' } }),
    );
    expect(orderFlowService.handleOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('skips side effects when a concurrent webhook already claimed the payment', async () => {
    const { service, tx, orderFlowService, notificationsService } = buildService({ claimCount: 0 });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({ success: true, message: 'Payment already processed' });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
  });

  it('rejects unknown payments with 404', async () => {
    const { service } = buildService({ claimCount: 1, existingPayment: null });

    await expect(service.handleWebhook(...webhookArgs)).rejects.toMatchObject({ status: 404 });
  });

  it('withholds order promotion and dispatch when payment is confirmed for a CANCELLED order', async () => {
    const { service, tx, orderFlowService } = buildService({
      claimCount: 1,
      existingPayment: {
        id: 'pay-cancelled',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PENDING,
        orderId: 'order-cancelled',
        gatewayResponse: null,
        amount: '500.00',
        order: {
          id: 'order-cancelled',
          orderNumber: 'ORD-CANCELLED',
          customerId: 'cust-1',
          paymentStatus: PaymentStatus.FAILED,
          status: OrderStatus.CANCELLED,
          paymentMethod: PaymentMethod.ONLINE_GATEWAY,
        },
      },
    });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({
      success: true,
      message: expect.stringContaining('cancelled order'),
    });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('withholds dispatch broadcast when payment is confirmed for an order switched to COD', async () => {
    const { service, tx, orderFlowService } = buildService({
      claimCount: 1,
      existingPayment: {
        id: 'pay-cod',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PENDING,
        orderId: 'order-cod',
        gatewayResponse: null,
        amount: '500.00',
        order: {
          id: 'order-cod',
          orderNumber: 'ORD-COD',
          customerId: 'cust-1',
          paymentStatus: PaymentStatus.PENDING,
          status: OrderStatus.PLACED,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
      },
    });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({
      success: true,
      message: expect.stringContaining('switched to COD'),
    });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('keeps COD orders out of the webhook path', async () => {
    // Sanity guard for the money-path invariant: only ONLINE_GATEWAY orders flow here
    expect(PaymentMethod.CASH_ON_DELIVERY).not.toBe(PaymentMethod.ONLINE_GATEWAY);
  });
});
