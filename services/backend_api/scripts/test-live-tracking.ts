import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { io, Socket } from 'socket.io-client';
import { UserRole } from '@prisma/client';

async function runLiveTrackingTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Live GPS Streaming & Tracking Tests');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4092;
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
    const branchManager = await login('+8801700000002');
    const rider = await login('+8801700000004');
    const customer = await login('+8801700000005');

    // Create an unrelated customer to test access permissions
    let otherCustomerUser = await prisma.user.findUnique({ where: { phone: '+8801700000007' } });
    if (!otherCustomerUser) {
      otherCustomerUser = await prisma.user.create({
        data: {
          phone: '+8801700000007',
          fullName: 'Tariq Anowar (Unrelated Customer)',
          role: UserRole.CUSTOMER,
          status: 'ACTIVE',
        },
      });
    }
    const otherCustomer = await login('+8801700000007');
    console.log('   ✅ Branch Manager, Rider, Order Customer, and Unrelated Customer authenticated.\n');

    // Ensure Rider is online
    await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider.token}` },
      body: JSON.stringify({ isOnline: true }),
    });

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

    // Place an order for live tracking test
    const orderRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({
        vendorId: gulshanOutlet!.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: inCoverageAddress!.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });
    const orderJson = await orderRes.json();
    if (!orderJson.data) {
      throw new Error(`Order checkout failed: status ${orderRes.status}, ${JSON.stringify(orderJson)}`);
    }
    const testOrderId = orderJson.data.orderId;
    console.log(`   Order Created: ${orderJson.data.orderNumber} (ID: ${testOrderId})`);

    // Advance order to DISPATCHED state
    // 1. Rider claims order
    await fetch(`${baseUrl}/rider/orders/${testOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    // 2. Vendor accepts and marks ready
    await fetch(`${baseUrl}/vendor/orders/${testOrderId}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchManager.token}` },
      body: JSON.stringify({ prepTimeMinutes: 15 }),
    });
    await fetch(`${baseUrl}/vendor/orders/${testOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    // 3. Rider picks up order -> DISPATCHED
    const pickupRes = await fetch(`${baseUrl}/rider/orders/${testOrderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    const pickupJson = await pickupRes.json();
    console.log(`   Order Picked Up & Dispatched: status=${pickupJson.data?.status}\n`);

    // -------------------------------------------------------------------------
    // Test 1: Realtime Rider GPS Telemetry Streaming over WebSocket
    // -------------------------------------------------------------------------
    console.log('📡 1. Testing Live GPS Telemetry Streaming over WebSocket...');

    // Customer connects and joins order room
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
    customerSocket.emit('order:join', { orderId: testOrderId });
    await new Promise((r) => setTimeout(r, 150));

    // Rider connects to socket
    const riderSocket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token: rider.token },
    });
    openSockets.push(riderSocket);

    await new Promise<void>((resolve, reject) => {
      riderSocket.on('connected', () => resolve());
      riderSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Rider socket timeout')), 4000);
    });

    // Setup listener on customer socket for order:rider:moved
    let receivedRiderMovedPayload: any = null;
    const riderMovedPromise = new Promise<void>((resolve, reject) => {
      customerSocket.once('order:rider:moved', (payload) => {
        receivedRiderMovedPayload = payload;
        resolve();
      });
      setTimeout(() => reject(new Error('Timed out waiting for order:rider:moved event')), 5000);
    });

    // Rider streams GPS coordinates
    console.log('   Rider emitting rider:location:update via WebSocket...');
    riderSocket.emit('rider:location:update', {
      latitude: 23.7930,
      longitude: 90.4080,
      bearing: 185.5,
      speed: 26.5,
      activeOrderId: testOrderId,
    });

    await riderMovedPromise;
    console.log(`   Received [order:rider:moved] on Customer Map Screen:`);
    console.log(`     Latitude: ${receivedRiderMovedPayload?.data?.riderLocation?.latitude}`);
    console.log(`     Longitude: ${receivedRiderMovedPayload?.data?.riderLocation?.longitude}`);
    console.log(`     Bearing: ${receivedRiderMovedPayload?.data?.riderLocation?.bearing}°`);
    console.log(`     Estimated Minutes Remaining: ${receivedRiderMovedPayload?.data?.estimatedMinutesRemaining} mins`);

    if (
      receivedRiderMovedPayload?.data?.riderLocation?.latitude !== 23.7930 ||
      receivedRiderMovedPayload?.data?.riderLocation?.longitude !== 90.4080 ||
      !receivedRiderMovedPayload?.data?.estimatedMinutesRemaining
    ) {
      throw new Error('Invalid rider telemetry payload received on customer socket');
    }
    console.log('   ✅ Realtime rider GPS coordinates and ETA streamed to customer room!\n');

    // -------------------------------------------------------------------------
    // Test 2: Order-Detail Polling Fallback (GET /orders/:id)
    // The customer app tracks via socket + order-detail polling; the dedicated
    // live-tracking endpoint was removed as dead code.
    // -------------------------------------------------------------------------
    console.log('🛰️  2. Testing Order-Detail Polling Fallback (GET /orders/:id)...');
    const trackingRes = await fetch(`${baseUrl}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });
    const trackingJson = await trackingRes.json();
    console.log(`   Response Status: ${trackingRes.status}`);

    if (trackingRes.status !== 200 || !trackingJson.data) {
      throw new Error(`Failed to retrieve order detail fallback: ${JSON.stringify(trackingJson)}`);
    }

    const tData = trackingJson.data;
    console.log(`   Order Status: ${tData.status}`);
    console.log(`   Rider Assigned: ${tData.rider ? tData.rider.user?.fullName || 'yes' : 'no'}`);

    if (tData.status !== 'DISPATCHED' || !tData.rider?.id) {
      throw new Error(
        `Order-detail fallback returned incomplete tracking state: status=${tData.status}, riderId=${tData.rider?.id ?? 'none'}, payload=${JSON.stringify(trackingJson).slice(0, 300)}`,
      );
    }
    console.log('   ✅ Order-detail polling fallback returned complete tracking state!\n');

    // -------------------------------------------------------------------------
    // Test 3: Unauthorized Access Guard
    // -------------------------------------------------------------------------
    console.log('🛡️  3. Testing Access Isolation on Order Detail...');
    const unauthorizedRes = await fetch(`${baseUrl}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${otherCustomer.token}` },
    });
    console.log(`   Unrelated Customer Access: status=${unauthorizedRes.status}`);
    if (unauthorizedRes.status !== 403) {
      throw new Error('Expected 403 Forbidden for customer accessing another user order');
    }
    console.log('   ✅ Order data strictly isolated to order owner!\n');

    console.log('====================================================');
    console.log(' 🎉 All Live Rider Location & Tracking Tests Passed!');
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

runLiveTrackingTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
