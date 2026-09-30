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

  it('marks the payment FAILED and skips dispatch when the gateway reports failure', async () => {
    const { service, tx, orderFlowService, verifyWebhook } = buildService({ claimCount: 1 });
    verifyWebhook.mockResolvedValue({
      isValid: true,
      transactionId: 'SSLC-1',
      orderId: 'order-1',
      amount: 500,
      status: PaymentStatus.FAILED,
      rawResponse: { status: 'FAILED' },
    } satisfies WebhookValidationResult);

    const result = await service.handleWebhook(...webhookArgs);

    expect(result).toMatchObject({ success: true, status: PaymentStatus.FAILED });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
    // A failed charge must never release fulfillment
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orderFlowService.handleOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects webhooks with invalid signatures before touching the ledger', async () => {
    const { service, tx, verifyWebhook } = buildService({ claimCount: 1 });
    verifyWebhook.mockResolvedValue({
      isValid: false,
      transactionId: 'SSLC-1',
      orderId: 'order-1',
      amount: 500,
      status: PaymentStatus.PAID,
      rawResponse: {},
    } satisfies WebhookValidationResult);

    await expect(service.handleWebhook(...webhookArgs)).rejects.toMatchObject({ status: 401 });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });
});

describe('initiatePayment validation guards', () => {
  function buildInitiateService(order: Record<string, unknown> | null) {
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pay-new' }),
      },
    };
    const redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    const sslcommerz = {
      initiatePayment: jest.fn().mockResolvedValue({
        transactionId: 'TRX-NEW',
        sessionKey: 'sk-1',
        paymentUrl: 'https://sandbox.sslcommerz.com/pay/TRX-NEW',
      }),
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
    return { service, prisma, redis, sslcommerz };
  }

  const payableOrder = {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerId: 'user-1',
    paymentMethod: PaymentMethod.ONLINE_GATEWAY,
    paymentStatus: PaymentStatus.PENDING,
    status: OrderStatus.PLACED,
    totalAmount: '250.00',
    customer: { id: 'user-1', phone: '+8801700000009', fullName: 'User 1' },
    vendor: { id: 'v-1', name: 'Store 1' },
  };

  it('returns 404 when the order does not exist', async () => {
    const { service } = buildInitiateService(null);

    await expect(
      service.initiatePayment('user-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SSLCOMMERZ }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 401 when a different user tries to pay for the order', async () => {
    const { service } = buildInitiateService(payableOrder);

    await expect(
      service.initiatePayment('intruder-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SSLCOMMERZ }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects orders placed with Cash on Delivery', async () => {
    const { service } = buildInitiateService({
      ...payableOrder,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    await expect(
      service.initiatePayment('user-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SSLCOMMERZ }),
    ).rejects.toThrow(/Cash on Delivery/);
  });

  it('rejects re-payment of an already PAID order (409)', async () => {
    const { service } = buildInitiateService({
      ...payableOrder,
      paymentStatus: PaymentStatus.PAID,
    });

    await expect(
      service.initiatePayment('user-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SSLCOMMERZ }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects payment for a CANCELLED order', async () => {
    const { service } = buildInitiateService({
      ...payableOrder,
      status: OrderStatus.CANCELLED,
    });

    await expect(
      service.initiatePayment('user-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SSLCOMMERZ }),
    ).rejects.toThrow(/cancelled order/);
  });

  it('creates a PENDING ledger record and returns the gateway payment URL', async () => {
    const { service, prisma, redis, sslcommerz } = buildInitiateService(payableOrder);

    const result = await service.initiatePayment('user-1', {
      orderId: 'order-1',
      gateway: SupportedPaymentGateway.SSLCOMMERZ,
    });

    expect(result).toMatchObject({
      paymentUrl: 'https://sandbox.sslcommerz.com/pay/TRX-NEW',
      transactionId: 'TRX-NEW',
      amount: 250,
      currency: 'BDT',
    });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          status: PaymentStatus.PENDING,
          gatewayResponse: { paymentUrl: 'https://sandbox.sslcommerz.com/pay/TRX-NEW' },
        }),
      }),
    );
    expect(sslcommerz.initiatePayment).toHaveBeenCalled();
    expect(redis.releaseLock).toHaveBeenCalled();
  });

  it('refuses unsupported gateway names', async () => {
    const { service } = buildInitiateService(payableOrder);

    await expect(
      service.initiatePayment('user-1', { orderId: 'order-1', gateway: 'crypto' as never }),
    ).rejects.toThrow(/Unsupported payment gateway/);
  });

  it('refuses the sandbox gateway when NODE_ENV is production', async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { service } = buildInitiateService(payableOrder);

    try {
      await expect(
        service.initiatePayment('user-1', { orderId: 'order-1', gateway: SupportedPaymentGateway.SANDBOX }),
      ).rejects.toThrow(/disabled in production/);
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
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

describe('getPaymentStatus ownership enforcement', () => {
  function buildStatusService(payment: Record<string, unknown> | null) {
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  const storedPayment = {
    id: 'pay-1',
    transactionId: 'TRX-9',
    gateway: 'SSLCOMMERZ',
    amount: '500.00',
    currency: 'BDT',
    status: PaymentStatus.PAID,
    paidAt: new Date('2026-09-01T10:00:00Z'),
    failedAt: null,
    refundId: null,
    refundedAt: null,
    createdAt: new Date('2026-09-01T09:58:00Z'),
    order: {
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: OrderStatus.PLACED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: '500.00',
      customerId: 'owner-1',
    },
  };

  it('returns a redacted status payload to the owning customer', async () => {
    const { service } = buildStatusService(storedPayment);

    const result = await service.getPaymentStatus('TRX-9', 'owner-1');

    expect(result).toMatchObject({ transactionId: 'TRX-9', status: PaymentStatus.PAID });
    expect(result.order).toEqual({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: OrderStatus.PLACED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: 500,
    });
  });

  it('returns 403 when another user queries a transaction they do not own', async () => {
    const { service } = buildStatusService(storedPayment);

    await expect(service.getPaymentStatus('TRX-9', 'intruder-1')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('returns 404 for unknown transaction ids', async () => {
    const { service } = buildStatusService(null);

    await expect(service.getPaymentStatus('TRX-404', 'owner-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('sweepExpiredPayments claim-then-reconcile cancellation', () => {
  type SweepTx = {
    order: { updateMany: jest.Mock };
    coupon: { updateMany: jest.Mock };
    commissionLedger: { deleteMany: jest.Mock };
    riderTripLedger: { deleteMany: jest.Mock };
    payment: { updateMany: jest.Mock };
  };

  function buildSweepService(options: {
    expiredOrder: Record<string, unknown> | null;
    claimCount: number;
  }) {
    const tx: SweepTx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount }) },
      coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      commissionLedger: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      riderTripLedger: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const trackingGateway = { server: { to: jest.fn().mockReturnThis(), emit: jest.fn() } };
    const prisma = {
      order: { findMany: jest.fn().mockResolvedValue(options.expiredOrder ? [options.expiredOrder] : []) },
      $transaction: jest.fn((fn: (t: SweepTx) => Promise<unknown>) => fn(tx)),
    };
    const notificationsService = { sendToUser: jest.fn().mockResolvedValue(true) };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      trackingGateway as never,
      notificationsService as never,
      {} as never,
      {} as never,
    );
    return { service, tx, prisma, notificationsService, trackingGateway };
  }

  const expiredOrder = {
    id: 'order-expired',
    orderNumber: 'ORD-EXPIRED',
    customerId: 'cust-1',
    vendorId: 'vendor-1',
    status: OrderStatus.PLACED,
    couponId: 'coupon-1',
    placedAt: new Date(Date.now() - 20 * 60 * 1000),
    payments: [],
  };

  it('does nothing when no orders have breached the 15-minute window', async () => {
    const { service, prisma, tx } = buildSweepService({ expiredOrder: null, claimCount: 1 });

    await service.sweepExpiredPayments();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('atomically cancels an expired order and rolls back coupon + pending ledgers', async () => {
    const { service, tx, notificationsService, trackingGateway } = buildSweepService({
      expiredOrder,
      claimCount: 1,
    });

    await service.sweepExpiredPayments();

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-expired', status: OrderStatus.PLACED, paymentStatus: PaymentStatus.PENDING },
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        }),
      }),
    );
    // Coupon usage is rolled back but never below zero
    expect(tx.coupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'coupon-1', currentUses: { gt: 0 } },
        data: { currentUses: { decrement: 1 } },
      }),
    );
    expect(tx.commissionLedger.deleteMany).toHaveBeenCalled();
    expect(tx.riderTripLedger.deleteMany).toHaveBeenCalled();
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-expired', status: PaymentStatus.PENDING },
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CANCELLED }) }),
    );
    expect(trackingGateway.server.to).toHaveBeenCalledWith('order_order-expired');
  });

  it('skips every destructive step when the claim loses to a concurrent webhook (count=0)', async () => {
    const { service, tx, notificationsService } = buildSweepService({
      expiredOrder,
      claimCount: 0,
    });

    await service.sweepExpiredPayments();

    expect(tx.order.updateMany).toHaveBeenCalled();
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
    expect(tx.commissionLedger.deleteMany).not.toHaveBeenCalled();
    expect(tx.riderTripLedger.deleteMany).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
  });
});

