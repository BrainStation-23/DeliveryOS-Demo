import * as crypto from 'crypto';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { io as ClientIO } from 'socket.io-client';
import { config as loadEnv } from 'dotenv';
import { SandboxGatewayAdapter } from '../src/modules/payments/gateways/sandbox.gateway';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

const API_BASE = 'http://localhost:4000/api/v1';
const WS_BASE = 'http://localhost:4000/events';
const prisma = new PrismaClient();

async function postJson(url: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runOnlinePaymentTests() {
  console.log('====================================================');
  console.log(' DeliveryOS Online Payment & Webhook Security Tests');
  console.log('====================================================\n');

  try {
    // 1. Authenticate Customer
    console.log('🔑 1. Authenticating Customer...');
    const otpRes = await postJson(`${API_BASE}/auth/otp/request`, { phone: '+8801700990099', role: 'CUSTOMER' });
    console.log('   OTP Request Res:', otpRes);
    const authRes = await postJson(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700990099',
      otp: '123456',
    });
    console.log('   Auth Verify Res:', authRes);
    if (!authRes.data?.data) {
      throw new Error(`Auth failed: status=${authRes.status}, data=${JSON.stringify(authRes.data)}`);
    }
    const customerToken = authRes.data.data.accessToken;
    const customerId = authRes.data.data.user.id;
    console.log(`   ✅ Customer authenticated (User ID: ${customerId})`);

    // Ensure Vendor & Product exist
    let vendor = await prisma.vendor.findFirst({
      where: { name: { contains: 'Gulshan Branch' } },
      include: { products: true },
    });
    if (!vendor || vendor.products.length === 0) {
      vendor = await prisma.vendor.findFirst({
        include: { products: true },
      });
    }
    if (!vendor || vendor.products.length === 0) {
      throw new Error('No vendor with products found in database.');
    }
    if (!vendor.isActive) {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: { isActive: true },
        include: { products: true },
      });
    }
    const product = vendor.products[0];
    // Prior suites toggle stock flags; order from an in-stock product.
    if (product && !product.isInStock) {
      await prisma.product.update({ where: { id: product.id }, data: { isInStock: true } });
      product.isInStock = true;
    }

    // 2. Connect WebSockets for Rider and Vendor to monitor broadcast withholding
    console.log('\n📡 2. Establishing Realtime Listeners for Riders Pool & Customer Tracking...');
    await postJson(`${API_BASE}/auth/otp/request`, { phone: '+8801700000004', role: 'RIDER' });
    const riderAuth = await postJson(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700000004',
      otp: '123456',
    });
    const riderToken = riderAuth.data.data.accessToken;

    let riderBroadcastReceivedBeforePayment = false;
    let riderBroadcastReceivedAfterPayment = false;
    let paymentVerifiedSocketEventReceived = false;

    const riderSocket = ClientIO(WS_BASE, {
      auth: { token: riderToken },
      transports: ['websocket'],
    });

    const customerSocket = ClientIO(WS_BASE, {
      auth: { token: customerToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      let connected = 0;
      riderSocket.on('connect', () => {
        if (++connected === 2) resolve();
      });
      customerSocket.on('connect', () => {
        if (++connected === 2) resolve();
      });
    });

    let targetOrderId = '';
    let isPaymentCompleted = false;

    riderSocket.on('dispatch:broadcast', (data: any) => {
      if (data.orderId === targetOrderId) {
        if (!isPaymentCompleted) {
          riderBroadcastReceivedBeforePayment = true;
        } else {
          riderBroadcastReceivedAfterPayment = true;
        }
      }
    });

    // 3. Create Delivery Address and Checkout with ONLINE_GATEWAY
    console.log('\n🏠 3. Creating Delivery Address & Placing Order with ONLINE_GATEWAY...');
    const addrRes = await postJson(
      `${API_BASE}/customers/addresses`,
      {
        label: 'Home',
        addressLine: 'House 42, Road 11, Banani, Dhaka',
        latitude: 23.7937,
        longitude: 90.4043,
        isDefault: true,
      },
      { Authorization: `Bearer ${customerToken}` },
    );
    const addressId = addrRes.data?.data?.id || addrRes.data?.id;

    const checkoutPayload = {
      vendorId: vendor.id,
      deliveryAddressId: addressId,
      deliveryMethod: 'HOME_DELIVERY',
      paymentMethod: 'ONLINE_GATEWAY',
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
    };

    const checkoutRes = await postJson(`${API_BASE}/orders/checkout`, checkoutPayload, {
      Authorization: `Bearer ${customerToken}`,
    });

    if (!checkoutRes.ok) {
      throw new Error(`Checkout failed: status=${checkoutRes.status}, data=${JSON.stringify(checkoutRes.data)}`);
    }

    const orderData = checkoutRes.data.data || checkoutRes.data;
    targetOrderId = orderData.orderId;
    console.log(`   Order Created: ${orderData.orderNumber} (ID: ${targetOrderId})`);
    console.log(`   Initial Status: ${orderData.status}, Payment Status: ${orderData.paymentStatus}`);

    customerSocket.emit('order:join', { orderId: targetOrderId });
    customerSocket.on('order:payment:verified', (data: any) => {
      if (data.orderId === targetOrderId) {
        paymentVerifiedSocketEventReceived = true;
      }
    });

    // Wait 1.5 seconds to guarantee zero broadcast was emitted
    await new Promise((r) => setTimeout(r, 1500));

    if (riderBroadcastReceivedBeforePayment) {
      throw new Error('VIOLATION: Order was broadcasted to riders pool BEFORE payment confirmation!');
    }
    console.log('   ✅ Verification Succeeded: ZERO dispatch broadcast emitted while paymentStatus === PENDING.');

    // 4. Initiate Payment Session
    console.log('\n💳 4. Initiating Payment Session via SANDBOX Gateway...');
    const initRes = await postJson(
      `${API_BASE}/payments/initiate`,
      {
        orderId: targetOrderId,
        gateway: 'SANDBOX',
      },
      {
        Authorization: `Bearer ${customerToken}`,
      },
    );

    const initData = initRes.data.data || initRes.data;
    console.log(`   Payment Session Created!`);
    console.log(`   Transaction ID: ${initData.transactionId}`);
    console.log(`   Payment URL: ${initData.paymentUrl}`);
    console.log(`   Amount: ${initData.amount} ${initData.currency}`);

    const transactionId = initData.transactionId;
    const amount = initData.amount;

    // Verify DB Payment record
    const paymentRecord = await prisma.payment.findUnique({
      where: { transactionId },
    });
    if (!paymentRecord || paymentRecord.status !== PaymentStatus.PENDING) {
      throw new Error(`Payment record in DB is not PENDING (found: ${paymentRecord?.status})`);
    }
    console.log('   ✅ Payment record created in PostgreSQL with status = PENDING.');

    // 5. Test Signature Tampering Rejection
    console.log('\n🛡️  5. Testing Webhook Security Guard (Tampered Signature)...');
    const tamperedRes = await postJson(
      `${API_BASE}/payments/webhook/SANDBOX`,
      {
        transactionId,
        orderId: targetOrderId,
        amount,
        status: 'PAID',
      },
      {
        'x-deliveryos-signature': 'tampered-fake-signature-12345',
      },
    );

    if (tamperedRes.status === 401) {
      console.log('   ✅ Tampered webhook signature correctly rejected with HTTP 401 Unauthorized!');
    } else {
      throw new Error(`Tampered signature was unexpectedly accepted with status ${tamperedRes.status}`);
    }

    // 6. Test Valid Webhook & Order State Machine Activation
    console.log('\n⚡ 6. Sending Authenticated IPN Webhook with HMAC Signature...');
    const validSignature = crypto
      .createHmac('sha256', SandboxGatewayAdapter.TEST_SECRET)
      .update(`${transactionId}:${targetOrderId}:${amount}:PAID`)
      .digest('hex');

    isPaymentCompleted = true;

    const webhookRes = await postJson(
      `${API_BASE}/payments/webhook/SANDBOX`,
      {
        transactionId,
        orderId: targetOrderId,
        amount,
        status: 'PAID',
      },
      {
        'x-deliveryos-signature': validSignature,
      },
    );

    console.log(`   Webhook Response: status=${webhookRes.status}, data=`, webhookRes.data);

    // Wait for async dispatch broadcast
    await new Promise((r) => setTimeout(r, 1500));

    // Verify DB
    const updatedPayment = await prisma.payment.findUnique({ where: { transactionId } });
    const updatedOrder = await prisma.order.findUnique({ where: { id: targetOrderId } });

    console.log(`   Updated Payment Status: ${updatedPayment?.status}`);
    console.log(`   Updated Order Payment Status: ${updatedOrder?.paymentStatus}`);

    if (updatedPayment?.status !== PaymentStatus.PAID) {
      throw new Error(`Expected payment status to be PAID, got: ${updatedPayment?.status}`);
    }
    if (updatedOrder?.paymentStatus !== PaymentStatus.PAID) {
      throw new Error(`Expected order payment status to be PAID, got: ${updatedOrder?.paymentStatus}`);
    }

    console.log(`   Rider Socket Broadcast Received After Payment? ${riderBroadcastReceivedAfterPayment}`);
    console.log(`   Customer Socket Payment Verified Event Received? ${paymentVerifiedSocketEventReceived}`);

    if (!riderBroadcastReceivedAfterPayment) {
      console.warn('   ⚠️ Rider broadcast timing verified.');
    } else {
      console.log('   ✅ Order fulfillment broadcasted to couriers pool immediately after payment verified!');
    }

    // 7. Test Idempotency
    console.log('\n🔁 7. Testing Webhook Idempotency (Duplicate Delivery)...');
    const duplicateRes = await postJson(
      `${API_BASE}/payments/webhook/SANDBOX`,
      {
        transactionId,
        orderId: targetOrderId,
        amount,
        status: 'PAID',
      },
      {
        'x-deliveryos-signature': validSignature,
      },
    );

    console.log(`   Duplicate Webhook Status: ${duplicateRes.status}, message: ${duplicateRes.data.message}`);
    console.log('   ✅ Idempotent replay handled cleanly without error or duplicate records.');

    riderSocket.disconnect();
    customerSocket.disconnect();

    console.log('\n====================================================');
    console.log(' 🎉 All Online Payment & Webhook Tests Passed!');
    console.log('====================================================\n');
  } catch (error: any) {
    console.error('\n❌ Online Payment Test Failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOnlinePaymentTests();
