import * as crypto from 'crypto';
import { PrismaClient, PaymentStatus, OrderStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { SandboxGatewayAdapter } from '../src/modules/payments/gateways/sandbox.gateway';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function patchJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runCancellationTests() {
  console.log('========================================================================');
  console.log(' DeliveryOS Order Cancellation, Vendor Rejection & Refund Flow Tests');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 0. Setup & Authentication
    // -------------------------------------------------------------------------
    console.log('🔑 0. Authenticating Personas (Customer, Vendor, Admin, Rider)...');

    // Customer
    await postJson(`${API_BASE}/auth/otp/request`, { phone: '+8801700990099', role: 'CUSTOMER' });
    const customerAuth = await postJson(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700990099',
      otp: '123456',
    });
    const customerToken = customerAuth.data.data.accessToken;

    // Super Admin (+8801700000001 from seed)
    await postJson(`${API_BASE}/auth/otp/request`, { phone: '+8801700000001' });
    const adminAuth = await postJson(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700000001',
      otp: '123456',
    });
    const adminToken = adminAuth.data.data.accessToken;

    // Active Vendor & Product
    const vendor = await prisma.vendor.findFirst({
      where: {
        isActive: true,
        products: { some: { isInStock: true } },
      },
      include: { products: { where: { isInStock: true } } },
    });
    if (!vendor || vendor.products.length === 0) {
      throw new Error('No active vendor with in-stock products found');
    }
    const product = vendor.products[0];
    // Prior suites toggle stock flags; order from an in-stock product.
    if (product && !product.isInStock) {
      await prisma.product.update({ where: { id: product.id }, data: { isInStock: true } });
      product.isInStock = true;
    }

    // Ensure vendor is open for test execution
    const currentDay = new Date().getDay();
    await prisma.vendorOperatingHour.upsert({
      where: { vendorId_dayOfWeek: { vendorId: vendor.id, dayOfWeek: currentDay } },
      update: { isClosed: false, openTime: '00:00:00', closeTime: '23:59:59' },
      create: {
        vendorId: vendor.id,
        dayOfWeek: currentDay,
        openTime: '00:00:00',
        closeTime: '23:59:59',
        isClosed: false,
      },
    });

    // Vendor Staff
    const vendorStaff = await prisma.vendorStaff.findFirst({
      where: { vendorId: vendor.id, isActive: true },
      include: { user: true },
    });
    let vendorToken = '';
    if (vendorStaff) {
      await postJson(`${API_BASE}/auth/otp/request`, { phone: vendorStaff.user.phone });
      const vAuth = await postJson(`${API_BASE}/auth/otp/verify`, {
        phone: vendorStaff.user.phone,
        otp: '123456',
      });
      vendorToken = vAuth.data.data.accessToken;
    } else {
      // Use Admin token as fallback for vendor operations
      vendorToken = adminToken;
    }

    // Deterministic courier: pin the seeded rider, clear stale in-flight trips
    // (the claim-time DB backstop refuses claims while one is open) and reset
    // accumulated COD cash so the cash-limit guard stays clear.
    const rider = await prisma.rider.findFirst({
      where: { user: { phone: '+8801700000004' } },
      include: { user: true },
    });
    let riderToken = '';
    if (rider) {
      await prisma.order.updateMany({
        where: {
          riderId: rider.id,
          status: { in: ['RIDER_ASSIGNED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date(), riderId: null },
      });
      await prisma.rider.update({
        where: { id: rider.id },
        data: { cashInHand: 0, isOnline: true },
      });
      await postJson(`${API_BASE}/auth/otp/request`, { phone: rider.user.phone });
      const rAuth = await postJson(`${API_BASE}/auth/otp/verify`, {
        phone: rider.user.phone,
        otp: '123456',
      });
      riderToken = rAuth.data.data.accessToken;
    }

    console.log('   ✅ Personas authenticated successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Customer cancels PLACED COD Order with coupon restored
    // -------------------------------------------------------------------------
    console.log('🧪 TEST 1: Customer Cancels PLACED COD Order (Coupon & Ledger Verification)...');

    // Check coupon state
    const coupon = await prisma.coupon.findUnique({ where: { code: 'WELCOME50' } });
    const couponInitialUses = coupon ? coupon.currentUses : 0;

    // Create or fetch delivery address for customer
    const addrRes = await postJson(
      `${API_BASE}/customers/addresses`,
      {
        label: 'Home',
        addressLine: 'House 12, Road 4, Gulshan-2, Dhaka',
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        isDefault: true,
      },
      { Authorization: `Bearer ${customerToken}` },
    );
    const deliveryAddressId = addrRes.data?.data?.id || addrRes.data?.id;

    // Checkout
    const checkout1 = await postJson(
      `${API_BASE}/orders/checkout`,
      {
        vendorId: vendor.id,
        items: [{ productId: product.id, quantity: Math.max(2, Math.ceil(300 / (Number(product.basePrice) || 50))) }],
        deliveryMethod: 'HOME_DELIVERY',
        paymentMethod: 'CASH_ON_DELIVERY',
        couponCode: coupon?.code,
        deliveryAddressId,
      },
      { Authorization: `Bearer ${customerToken}` },
    );

    if (!checkout1.ok) {
      throw new Error(`Checkout 1 failed: ${JSON.stringify(checkout1.data)}`);
    }
    const order1Id = checkout1.data.data.orderId;
    console.log(`   Order placed: ID=${order1Id}, Status=${checkout1.data.data.status}`);

    // Verify ledger and coupon were created/incremented
    const ledgerBefore = await prisma.commissionLedger.findFirst({ where: { orderId: order1Id } });
    if (!ledgerBefore) {
      throw new Error('Expected CommissionLedger to be created at checkout');
    }
    if (coupon) {
      const couponAfterOrder = await prisma.coupon.findUnique({ where: { id: coupon.id } });
      if (couponAfterOrder && couponAfterOrder.currentUses !== couponInitialUses + 1) {
        throw new Error(`Expected coupon uses to increment by 1`);
      }
    }

    // Customer cancels order
    const cancel1 = await postJson(
      `${API_BASE}/orders/${order1Id}/cancel`,
      { reason: 'Customer changed delivery address' },
      { Authorization: `Bearer ${customerToken}` },
    );

    if (!cancel1.ok) {
      throw new Error(`Cancel 1 failed: ${JSON.stringify(cancel1.data)}`);
    }
    console.log(`   Cancel response: ${cancel1.data.message}`);

    // Check DB state
    const dbOrder1 = await prisma.order.findUnique({ where: { id: order1Id } });
    if (dbOrder1?.status !== OrderStatus.CANCELLED) {
      throw new Error(`Expected status CANCELLED, got: ${dbOrder1?.status}`);
    }
    if (!dbOrder1.cancelledAt) {
      throw new Error('Expected cancelledAt timestamp to be populated');
    }
    if (dbOrder1.rejectionReason !== 'Customer changed delivery address') {
      throw new Error(`Unexpected cancellation reason: ${dbOrder1.rejectionReason}`);
    }

    // Verify CommissionLedger is deleted
    const ledgerAfter = await prisma.commissionLedger.findFirst({ where: { orderId: order1Id } });
    if (ledgerAfter) {
      throw new Error('Pending CommissionLedger was not deleted on cancellation!');
    }

    // Verify Coupon uses decremented
    if (coupon) {
      const couponAfterCancel = await prisma.coupon.findUnique({ where: { id: coupon.id } });
      if (couponAfterCancel && couponAfterCancel.currentUses !== couponInitialUses) {
        throw new Error(`Expected coupon uses to return to initial count: ${couponInitialUses}, got: ${couponAfterCancel?.currentUses}`);
      }
    }

    console.log('   ✅ TEST 1 PASSED: Order cancelled, ledger deleted, coupon quota restored.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Customer is blocked from cancelling PREPARING order
    // -------------------------------------------------------------------------
    console.log('🧪 TEST 2: Customer Self-Cancellation Blocked Once Preparation Starts...');

    const checkout2 = await postJson(
      `${API_BASE}/orders/checkout`,
      {
        vendorId: vendor.id,
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'HOME_DELIVERY',
        paymentMethod: 'CASH_ON_DELIVERY',
        deliveryAddressId,
      },
      { Authorization: `Bearer ${customerToken}` },
    );
    const order2Id = checkout2.data.data.orderId;

    // RIDER_FIRST contract: a courier must secure the order before the kitchen
    // can accept (accepting a PLACED order would strand it in PREPARING).
    if (rider && riderToken) {
      const claim2 = await postJson(
        `${API_BASE}/rider/orders/${order2Id}/claim`,
        {},
        { Authorization: `Bearer ${riderToken}` },
      );
      if (!claim2.ok) {
        throw new Error(`Rider claim failed: ${JSON.stringify(claim2.data)}`);
      }
    } else {
      throw new Error('Seeded courier unavailable: cannot run the claim-to-accept flow');
    }

    // Vendor accepts order -> PREPARING
    const acceptRes = await patchJson(
      `${API_BASE}/vendor/orders/${order2Id}/accept`,
      { prepTimeMinutes: 20 },
      { Authorization: `Bearer ${vendorToken}` },
    );
    if (!acceptRes.ok) {
      throw new Error(`Vendor accept failed: ${JSON.stringify(acceptRes.data)}`);
    }
    console.log(`   Order moved to PREPARING by vendor kitchen.`);

    // Customer attempts to cancel
    const cancel2 = await postJson(
      `${API_BASE}/orders/${order2Id}/cancel`,
      { reason: 'Too slow, I want to cancel' },
      { Authorization: `Bearer ${customerToken}` },
    );

    if (cancel2.status === 400) {
      console.log(`   ✅ Correctly rejected with 400 Bad Request: "${cancel2.data.message}"`);
    } else {
      throw new Error(`Expected 400 Bad Request, got status ${cancel2.status}: ${JSON.stringify(cancel2.data)}`);
    }
    console.log('   ✅ TEST 2 PASSED: Pre-prep boundary successfully protected.\n');

    // Fixture cleanup: release the courier from the completed assertion order
    // so TEST 4's claim is not blocked by the DB in-flight backstop.
    if (rider) {
      await prisma.order.update({
        where: { id: order2Id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), riderId: null },
      });
      await prisma.commissionLedger.deleteMany({
        where: { orderId: order2Id, settlementStatus: 'PENDING' },
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Vendor Rejects PLACED Order with Structured Reason
    // -------------------------------------------------------------------------
    console.log('🧪 TEST 3: Vendor Kitchen Rejects Incoming Order...');

    const checkout3 = await postJson(
      `${API_BASE}/orders/checkout`,
      {
        vendorId: vendor.id,
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'HOME_DELIVERY',
        paymentMethod: 'CASH_ON_DELIVERY',
        deliveryAddressId,
      },
      { Authorization: `Bearer ${customerToken}` },
    );
    const order3Id = checkout3.data.data.orderId;

    // Vendor rejects order
    const rejectRes = await postJson(
      `${API_BASE}/vendor/orders/${order3Id}/reject`,
      {
        reasonCode: 'OUT_OF_STOCK',
        reasonNotes: 'Chef reports ingredients exhausted for tonight',
      },
      { Authorization: `Bearer ${vendorToken}` },
    );

    if (!rejectRes.ok) {
      throw new Error(`Vendor reject failed: ${JSON.stringify(rejectRes.data)}`);
    }
    console.log(`   Vendor reject response: ${rejectRes.data.message}`);

    const dbOrder3 = await prisma.order.findUnique({ where: { id: order3Id } });
    if (dbOrder3?.status !== OrderStatus.CANCELLED) {
      throw new Error(`Expected status CANCELLED, got: ${dbOrder3?.status}`);
    }
    if (!dbOrder3.rejectionReason?.includes('OUT_OF_STOCK')) {
      throw new Error(`Expected rejectionReason to contain OUT_OF_STOCK, got: ${dbOrder3.rejectionReason}`);
    }

    console.log('   ✅ TEST 3 PASSED: Vendor rejection completed and reason recorded.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Admin Force-Cancels Paid Online Order & Releases Assigned Courier
    // -------------------------------------------------------------------------
    console.log('🧪 TEST 4: Admin Force-Cancels Online Paid Order (Refund & Courier Release)...');

    const checkout4 = await postJson(
      `${API_BASE}/orders/checkout`,
      {
        vendorId: vendor.id,
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'HOME_DELIVERY',
        paymentMethod: 'ONLINE_GATEWAY',
        deliveryAddressId,
      },
      { Authorization: `Bearer ${customerToken}` },
    );
    const order4Id = checkout4.data.data.orderId;

    // Simulate online payment session initiation & payment
    const initPay = await postJson(
      `${API_BASE}/payments/initiate`,
      { orderId: order4Id, gateway: 'SANDBOX' },
      { Authorization: `Bearer ${customerToken}` },
    );
    const transactionId = initPay.data.data.transactionId;
    const amount = checkout4.data.data.totalAmount;

    // Simulate gateway webhook confirmation with HMAC signature
    const validSignature = crypto
      .createHmac('sha256', SandboxGatewayAdapter.TEST_SECRET)
      .update(`${transactionId}:${order4Id}:${amount}:PAID`)
      .digest('hex');

    const webhookRes = await postJson(
      `${API_BASE}/payments/webhook/SANDBOX`,
      {
        orderId: order4Id,
        transactionId,
        status: 'PAID',
        amount,
      },
      {
        'x-deliveryos-signature': validSignature,
      },
    );

    if (!webhookRes.ok) {
      throw new Error(`Webhook failed: ${JSON.stringify(webhookRes.data)}`);
    }

    // Wait a brief moment for async broadcast
    await new Promise((r) => setTimeout(r, 1000));

    const paidOrder = await prisma.order.findUnique({ where: { id: order4Id } });
    if (paidOrder?.paymentStatus !== PaymentStatus.PAID) {
      throw new Error(`Expected paymentStatus PAID, got: ${paidOrder?.paymentStatus}`);
    }
    console.log(`   Online order ${paidOrder.orderNumber} successfully marked PAID.`);

    // If active rider exists, let rider claim order
    if (rider && riderToken) {
      await postJson(
        `${API_BASE}/rider/orders/${order4Id}/claim`,
        {},
        { Authorization: `Bearer ${riderToken}` },
      );
      const claimedOrder = await prisma.order.findUnique({ where: { id: order4Id } });
      console.log(`   Rider assigned to order: riderId=${claimedOrder?.riderId}`);
    }

    // Super Admin force-cancels order
    const adminCancel = await postJson(
      `${API_BASE}/admin/orders/${order4Id}/cancel`,
      { reason: 'Customer escalated order delay through emergency hotline' },
      { Authorization: `Bearer ${adminToken}` },
    );

    if (!adminCancel.ok) {
      throw new Error(`Admin cancel failed: ${JSON.stringify(adminCancel.data)}`);
    }
    console.log(`   Admin cancel response: ${adminCancel.data.message}`);

    const dbOrder4 = await prisma.order.findUnique({
      where: { id: order4Id },
      include: { payments: true },
    });

    if (dbOrder4?.status !== OrderStatus.CANCELLED) {
      throw new Error(`Expected status CANCELLED, got: ${dbOrder4?.status}`);
    }
    if (dbOrder4.paymentStatus !== PaymentStatus.REFUNDED) {
      throw new Error(`Expected order paymentStatus REFUNDED, got: ${dbOrder4.paymentStatus}`);
    }
    const refundedPayment = dbOrder4.payments.find((p) => p.status === PaymentStatus.REFUNDED);
    if (!refundedPayment) {
      throw new Error('Payment record was not transitioned to REFUNDED');
    }
    if (dbOrder4.riderId !== null) {
      throw new Error(`Expected riderId to be detached (null), got: ${dbOrder4.riderId}`);
    }

    console.log('   ✅ TEST 4 PASSED: Admin force-cancelled, payment refunded, rider unassigned.\n');

    console.log('========================================================================');
    console.log(' 🎉 ALL 4 ORDER CANCELLATION & REFUND TEST SUITES PASSED 100%!');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCancellationTests();
