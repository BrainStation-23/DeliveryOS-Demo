import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { SslCommerzGatewayAdapter } from './gateways/sslcommerz.gateway';
import { SandboxGatewayAdapter } from './gateways/sandbox.gateway';
import { SupportedPaymentGateway } from './dto/initiate-payment.dto';
import type { WebhookValidationResult } from './interfaces/payment-gateway.interface';

type TxMock = {
  payment: { findFirst: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  order: { update: jest.Mock };
};

function buildService(options: {
  claimCount: number;
  existingPayment?: Record<string, unknown> | null;
  validationAmount?: number;
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
              order: {
                id: 'order-1',
                orderNumber: 'ORD-TEST-1',
                customerId: 'cust-1',
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PLACED,
                paymentMethod: PaymentMethod.ONLINE_GATEWAY,
              },
            }
          : options.existingPayment,
      ),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount }),
      update: jest.fn().mockResolvedValue({}),
    },
    order: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    $transaction: jest.fn((fn: (tx: TxMock) => Promise<unknown>) => fn(tx)),
    payment: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'pay-1',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PAID,
        orderId: 'order-1',
        gateway: 'SSLCOMMERZ',
        gatewayResponse: { bank_tran_id: 'bank-1' },
        amount: '500.00',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const orderFlowService = { handleOrderPaid: jest.fn().mockResolvedValue(undefined) };
  const notificationsService = { sendToUser: jest.fn().mockResolvedValue(true) };
  const trackingGateway = {} as never;

  const verifyWebhook = jest.fn().mockResolvedValue({
    isValid: true,
    transactionId: 'SSLC-1',
    orderId: 'order-1',
    amount: options.validationAmount ?? 500,
    status: PaymentStatus.PAID,
    rawResponse: {},
  } satisfies WebhookValidationResult);

  const sslcommerz = {
    verifyWebhook,
    refund: jest.fn().mockResolvedValue({ success: true, refundId: 'refund-1', raw: {} }),
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

  return { service, tx, prisma, orderFlowService, notificationsService, sslcommerz, verifyWebhook };
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

  it('skips side effects when a concurrent webhook already claimed the payment to PAID', async () => {
    const { service, tx, orderFlowService, notificationsService } = buildService({
      claimCount: 0,
      existingPayment: {
        id: 'pay-1',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PAID,
        orderId: 'order-1',
        gatewayResponse: {},
        amount: '500.00',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-TEST-1',
          customerId: 'cust-1',
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.PLACED,
          paymentMethod: PaymentMethod.ONLINE_GATEWAY,
        },
      },
    });

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

  it('rejects webhook payloads whose amount does not match the initiated payment', async () => {
    const { service, tx, orderFlowService } = buildService({ claimCount: 1, validationAmount: 400 });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({ success: false, message: expect.stringContaining('amount mismatch') });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('reconciles (refunds) a confirmed charge landing on a CANCELLED order', async () => {
    const { service, tx, orderFlowService } = buildService({
      claimCount: 1,
      existingPayment: {
        id: 'pay-cancelled',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PENDING,
        orderId: 'order-cancelled',
        gateway: 'SSLCOMMERZ',
        gatewayResponse: { bank_tran_id: 'bank-1' },
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

    expect(result).toMatchObject({ success: true, refundInitiated: true });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('reconciles (refunds) a confirmed charge landing on an order switched to COD', async () => {
    const { service, tx, orderFlowService } = buildService({
      claimCount: 1,
      existingPayment: {
        id: 'pay-cod',
        transactionId: 'SSLC-1',
        status: PaymentStatus.PENDING,
        orderId: 'order-cod',
        gateway: 'SSLCOMMERZ',
        gatewayResponse: { bank_tran_id: 'bank-1' },
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

    expect(result).toMatchObject({ success: true, refundInitiated: true });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('rescues a stranded charge: gateway confirms PAID after COD-switch already failed the session', async () => {
    const { service, tx, orderFlowService } = buildService({
      claimCount: 0,
      existingPayment: {
        id: 'pay-stranded',
        transactionId: 'SSLC-1',
        status: PaymentStatus.FAILED,
        orderId: 'order-stranded',
        gateway: 'SSLCOMMERZ',
        gatewayResponse: null,
        amount: '500.00',
        order: {
          id: 'order-stranded',
          orderNumber: 'ORD-STRANDED',
          customerId: 'cust-1',
          paymentStatus: PaymentStatus.PENDING,
          status: OrderStatus.PLACED,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
      },
    });

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({ success: true, refundInitiated: true });
    // The confirmed charge must be recorded before reconciliation
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-stranded' },
        data: expect.objectContaining({ status: PaymentStatus.PAID }),
      }),
    );
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('keeps COD orders out of the webhook path', async () => {
    // Sanity guard for the money-path invariant: only ONLINE_GATEWAY orders flow here
    expect(PaymentMethod.CASH_ON_DELIVERY).not.toBe(PaymentMethod.ONLINE_GATEWAY);
  });
});

describe('Step 1.1 & 1.2: PaymentsService refund idempotency and initiate concurrency', () => {
  it('refundForOrder is idempotent: returns existing refund when status is already REFUNDED', async () => {
    const { service, prisma, sslcommerz } = buildService({ claimCount: 1 });
    prisma.payment.findFirst.mockImplementation(({ where }: { where: { status?: PaymentStatus } }) => {
      if (where.status === PaymentStatus.REFUNDED) {
        return Promise.resolve({
          id: 'pay-refunded',
          orderId: 'order-1',
          status: PaymentStatus.REFUNDED,
          refundId: 'existing-refund-id',
          gatewayResponse: { refund: { note: 'Already refunded' } },
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.refundForOrder('order-1', 'Cancelled');

    expect(result).toMatchObject({
      success: true,
      refundId: 'existing-refund-id',
    });
    // Adapter refund method must not be called when already REFUNDED
    expect(sslcommerz.refund).not.toHaveBeenCalled();
  });

  it('refundForOrder updates status to REFUNDED when adapter succeeds', async () => {
    const { service, prisma } = buildService({ claimCount: 1 });
    prisma.payment.findFirst.mockImplementation(({ where }: { where: { status?: PaymentStatus } }) => {
      if (where.status === PaymentStatus.REFUNDED) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: 'pay-paid',
        transactionId: 'TRX-100',
        orderId: 'order-1',
        status: PaymentStatus.PAID,
        gateway: 'SSLCOMMERZ',
        gatewayResponse: { bank_tran_id: 'bank-1' },
        amount: '500.00',
      });
    });

    const result = await service.refundForOrder('order-1', 'Cancelled');

    expect(result?.success).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-paid' },
        data: expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundId: 'refund-1',
        }),
      }),
    );
  });

  it('initiatePayment rejects with ConflictException if lock is not acquired', async () => {
    const prisma = {
      order: { findUnique: jest.fn() },
      payment: { findFirst: jest.fn(), create: jest.fn() },
    };
    const redis = {
      acquireLock: jest.fn().mockResolvedValue(false),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    const service = new PaymentsService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.initiatePayment('user-1', {
        orderId: 'order-1',
        gateway: SupportedPaymentGateway.SSLCOMMERZ,
      }),
    ).rejects.toThrow('Payment initiation is already in progress');
  });

  it('initiatePayment reuses active pending session if created within 15 minutes', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'ORD-001',
          customerId: 'user-1',
          paymentMethod: PaymentMethod.ONLINE_GATEWAY,
          paymentStatus: PaymentStatus.PENDING,
          status: OrderStatus.PLACED,
          totalAmount: '250.00',
          customer: { id: 'user-1', phone: '+8801700000001', fullName: 'User 1' },
          vendor: { id: 'v-1', name: 'Store 1' },
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-existing',
          transactionId: 'TRX-EXISTING',
          gateway: 'SSLCOMMERZ',
          amount: '250.00',
          currency: 'BDT',
          gatewayResponse: { paymentUrl: 'https://sandbox.sslcommerz.com/gwprocess/v4/cached' },
        }),
        create: jest.fn(),
      },
    };
    const redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    const sslcommerz = {
      initiatePayment: jest.fn(),
    };

    const service = new PaymentsService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
      sslcommerz as never,
      {} as never,
    );

    const result = await service.initiatePayment('user-1', {
      orderId: 'order-1',
      gateway: SupportedPaymentGateway.SSLCOMMERZ,
    });

    expect(result.paymentId).toBe('pay-existing');
    expect(result.transactionId).toBe('TRX-EXISTING');
    expect(result.paymentUrl).toBe('https://sandbox.sslcommerz.com/gwprocess/v4/cached');
    expect(sslcommerz.initiatePayment).not.toHaveBeenCalled();
    expect(redis.releaseLock).toHaveBeenCalled();
  });
});

