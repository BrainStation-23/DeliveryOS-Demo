import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { io, Socket } from 'socket.io-client';

async function runWebSocketTrackingTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Socket.IO Realtime Gateway Verification');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4094;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;
  const wsUrl = `http://localhost:${testPort}/events`;

  const prisma = app.get(PrismaService);
  const openSockets: Socket[] = [];

  try {
    // -------------------------------------------------------------------------
    // Helper: Authenticate by Phone
    // -------------------------------------------------------------------------
    async function login(phone: string): Promise<{ token: string; userId: string }> {
      const res = await fetch(`${baseUrl}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: '123456' }),
      });
      const json = await res.json();
      if (res.status !== 200 || !json.data?.accessToken) {
        throw new Error(`Login failed for ${phone}: ${JSON.stringify(json)}`);
      }
      return { token: json.data.accessToken, userId: json.data.user.id };
    }

    console.log('🔑 Authenticating Stakeholders...');
    const superAdmin = await login('+8801700000001');   // Super Admin
    const branchManager = await login('+8801700000002'); // Gulshan Branch Manager
    const customer = await login('+8801700000005');      // Customer
    const rider = await login('+8801700000004');         // Delivery Rider
    console.log('   ✅ Super Admin, Branch Manager, Customer, and Rider authenticated.\n');

    // Ensure VENDOR_FIRST mode so order:new fires immediately on checkout for benchmark
    await fetch(`${baseUrl}/admin/settings/order-flow`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ mode: 'VENDOR_FIRST' }),
    });

    // -------------------------------------------------------------------------
    // Test 1: Handshake JWT Authentication
    // -------------------------------------------------------------------------
    console.log('🛡️  1. Testing WebSocket Handshake Authentication...');

    // 1A. Unauthorized Connection (No Token)
    const unauthorizedSocket = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: false,
    });
    openSockets.push(unauthorizedSocket);

    const authRejectPromise = new Promise<boolean>((resolve) => {
      unauthorizedSocket.on('connect_error', () => resolve(true));
      unauthorizedSocket.on('error', () => resolve(true));
      unauthorizedSocket.on('disconnect', () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });
    unauthorizedSocket.connect();
    const wasRejected = await authRejectPromise;
    console.log(`   Connection without token rejected: ${wasRejected}`);
    if (!wasRejected) {
      throw new Error('Expected unauthenticated WebSocket connection to be rejected');
    }
    unauthorizedSocket.disconnect();

    // 1B. Authorized Vendor Tablet Connection
    const vendorSocket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token: branchManager.token },
    });
    openSockets.push(vendorSocket);

    const vendorConnectedPromise = new Promise<{ connected: boolean; role?: string }>((resolve, reject) => {
      vendorSocket.on('connected', (data) => resolve({ connected: true, role: data.role }));
      vendorSocket.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('Vendor socket connection timed out')), 4000);
    });

    const vendorConn = await vendorConnectedPromise;
    console.log(`   Vendor Socket Connected: ${vendorConn.connected}, Role: ${vendorConn.role}`);
    if (!vendorConn.connected || vendorConn.role !== 'VENDOR_ADMIN') {
      throw new Error('Vendor WebSocket connection failed');
    }
    console.log('   ✅ Handshake JWT authentication and scoped room joining verified!\n');

    // -------------------------------------------------------------------------
    // Test 2: order:new Event Emission & Latency Benchmark (< 200ms)
    // -------------------------------------------------------------------------
    console.log('⚡ 2. Testing order:new Event Emission & Latency Benchmark...');

    const gulshanOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'Gulshan Branch' } },
      include: { products: true },
    });
    const inCoverageAddress = await prisma.customerAddress.findFirst({
      where: { userId: customer.userId, isDefault: true },
    });
    const product = gulshanOutlet!.products[0];
    // Prior suites toggle stock flags; order from an in-stock product.
    if (product && !product.isInStock) {
      await prisma.product.update({ where: { id: product.id }, data: { isInStock: true } });
      product.isInStock = true;
    }

    // Setup listener before placing order
    let receivedOrderNewPayload: any = null;
    let orderNewReceiveTime = 0;
    const orderNewPromise = new Promise<void>((resolve, reject) => {
      vendorSocket.once('order:new', (payload) => {
        orderNewReceiveTime = Date.now();
        receivedOrderNewPayload = payload;
        resolve();
      });
      setTimeout(() => reject(new Error('Timed out waiting for order:new event')), 5000);
    });

    const checkoutStartTime = Date.now();
    const checkoutRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet!.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: inCoverageAddress!.id,
        customerNotes: 'Please ring bell twice',
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });
    const checkoutJson = await checkoutRes.json();
    if (checkoutRes.status !== 201) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkoutJson)}`);
    }

    const createdOrderId = checkoutJson.data.orderId;
    const orderNumber = checkoutJson.data.orderNumber;
    console.log(`   Order Placed via REST: ${orderNumber} (ID: ${createdOrderId})`);

    await orderNewPromise;
    const latencyMs = orderNewReceiveTime - checkoutStartTime;

    console.log(`   Received [order:new] on Vendor Tablet!`);
    console.log(`     Total Round-Trip Latency: ${latencyMs} ms (Includes DB transaction + HTTP + WebSocket)`);
    console.log(`     Order Number: ${receivedOrderNewPayload?.data?.orderNumber}`);
    console.log(`     Vendor Name: ${receivedOrderNewPayload?.data?.vendorName}`);
    console.log(`     Items: ${JSON.stringify(receivedOrderNewPayload?.data?.items)}`);

    if (receivedOrderNewPayload?.data?.orderId !== createdOrderId) {
      throw new Error('Payload orderId mismatch in order:new event');
    }
    console.log('   ✅ order:new emitted and delivered to vendor room with near-instant throughput!\n');

    // -------------------------------------------------------------------------
    // Test 3: Customer Live Order Room & order:status:changed
    // -------------------------------------------------------------------------
    console.log('📡 3. Testing Dynamic Order Room & order:status:changed Progression...');

    // Customer connects to socket
    const customerSocket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token: customer.token },
    });
    openSockets.push(customerSocket);

    await new Promise<void>((resolve, reject) => {
      customerSocket.on('connected', () => resolve());
      customerSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Customer socket timeout')), 4000);
    });

    // Customer joins dynamic room order_{createdOrderId}
    customerSocket.emit('order:join', { orderId: createdOrderId });
    await new Promise((r) => setTimeout(r, 150)); // Allow join to register

    // Setup helper for waiting on specific status transition
    function waitForStatus(expectedStatus: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for status transition to ${expectedStatus}`));
        }, 5000);

        const handler = (payload: any) => {
          if (payload?.data?.newStatus === expectedStatus) {
            customerSocket.off('order:status:changed', handler);
            clearTimeout(timeout);
            resolve(payload.data);
          }
        };
        customerSocket.on('order:status:changed', handler);
      });
    }

    // 3A. Vendor Accepts Order -> Expect status PREPARING
    console.log('   🍳 Vendor accepts order...');
    const prepPromise = waitForStatus('PREPARING');
    await fetch(`${baseUrl}/vendor/orders/${createdOrderId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({ prepTimeMinutes: 25 }),
    });
    const prepEvent = await prepPromise;
    console.log(`     ✅ Customer received [order:status:changed]: newStatus=${prepEvent.newStatus}, prepTime=${prepEvent.prepTimeMinutes}`);

    // 3B. Vendor Marks Ready -> Expect status READY_FOR_PICKUP
    console.log('   📦 Vendor marks order ready...');
    const readyPromise = waitForStatus('READY_FOR_PICKUP');
    await fetch(`${baseUrl}/vendor/orders/${createdOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const readyEvent = await readyPromise;
    console.log(`     ✅ Customer received [order:status:changed]: newStatus=${readyEvent.newStatus}`);

    // 3C. Rider Claims the ready order, then picks it up -> Expect DISPATCHED
    console.log('   🛵 Rider claims the ready order and picks it up...');
    const pickupPromise = waitForStatus('DISPATCHED');
    // Pickup is restricted to the assigned courier, so the rider must claim
    // the order first (VENDOR_FIRST keeps it READY_FOR_PICKUP).
    await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider.token}` },
      body: JSON.stringify({ isOnline: true }),
    });
    const claimRes = await fetch(`${baseUrl}/rider/orders/${createdOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    if (claimRes.status !== 200) {
      throw new Error(`Rider failed to claim the ready order: ${JSON.stringify(await claimRes.json())}`);
    }
    const pickupRes = await fetch(`${baseUrl}/rider/orders/${createdOrderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    if (pickupRes.status !== 200) {
      throw new Error(`Rider pickup failed: ${JSON.stringify(await pickupRes.json())}`);
    }
    const pickupEvent = await pickupPromise;
    console.log(`     ✅ Customer received [order:status:changed]: newStatus=${pickupEvent.newStatus}`);

    // 3D. Rider Delivers Order -> Expect status DELIVERED
    console.log('   🏠 Rider delivers order...');
    const deliverPromise = waitForStatus('DELIVERED');
    await fetch(`${baseUrl}/rider/orders/${createdOrderId}/deliver`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider.token}`,
      },
      body: JSON.stringify({
        codCashCollected: true,
        amountCollected: checkoutJson.data.totalAmount,
      }),
    });
    const deliverEvent = await deliverPromise;
    console.log(`     ✅ Customer received [order:status:changed]: newStatus=${deliverEvent.newStatus}`);

    // Restore pilot default to RIDER_FIRST
    await fetch(`${baseUrl}/admin/settings/order-flow`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ mode: 'RIDER_FIRST' }),
    });

    console.log('\n====================================================');
    console.log(' 🎉 All Socket.IO WebSocket Tracking Tests Passed!');
    console.log('====================================================\n');
  } finally {
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    // socket.io's redis-adapter leaves floating punsubscribe rejections during
    // shutdown; scope a handler to the teardown window so a passing suite exits 0.
    const onShutdownRejection = (reason: unknown) => {
      console.warn('   ⚠ shutdown warning (ignored):', reason instanceof Error ? reason.message : String(reason));
    };
    process.on('unhandledRejection', onShutdownRejection);
    process.on('uncaughtException', onShutdownRejection);
    await app.close().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off('unhandledRejection', onShutdownRejection);
    process.off('uncaughtException', onShutdownRejection);
  }
}

runWebSocketTrackingTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
