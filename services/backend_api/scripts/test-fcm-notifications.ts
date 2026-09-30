import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { OrderFlowService } from '../src/modules/order-flow/order-flow.service';
import { OrderStatus } from '@prisma/client';

async function runFcmAndEscalationTest() {
  console.log('====================================================');
  console.log(' DeliveryOS FCM & Dispatch Escalation Verification Suite');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4098;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);
  const notificationsService = app.get(NotificationsService);
  const orderFlowService = app.get(OrderFlowService);

  try {
    // -------------------------------------------------------------------------
    // 1. Authenticate Customer to obtain JWT
    // -------------------------------------------------------------------------
    console.log('🔑 1. Authenticating Customer...');
    const verifyRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+8801700000005', otp: '123456' }),
    });
    const verifyJson = await verifyRes.json();
    const customerToken = verifyJson.data?.accessToken;
    const customerId = verifyJson.data?.user?.id;
    if (!customerToken || !customerId) throw new Error('Customer authentication failed');
    console.log(`   ✅ Authenticated customer ID: ${customerId}\n`);

    // -------------------------------------------------------------------------
    // 2. Register Device Push Notification Token
    // -------------------------------------------------------------------------
    console.log('📱 2. Testing POST /auth/device-token...');
    const testFcmToken = 'fcm_test_token_sample_device_abc123';
    const regRes = await fetch(`${baseUrl}/auth/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        fcmToken: testFcmToken,
        platform: 'android',
      }),
    });
    const regJson = await regRes.json();
    console.log(`   Response: status=${regRes.status}, success=${regJson.success}`);
    if (regRes.status !== 200 || !regJson.success) {
      throw new Error(`Device token registration failed: ${JSON.stringify(regJson)}`);
    }

    // Verify token stored in DB
    const updatedUser = await prisma.user.findUnique({
      where: { id: customerId },
      select: { fcmToken: true, devicePlatform: true },
    });
    if (updatedUser?.fcmToken !== testFcmToken || updatedUser?.devicePlatform !== 'android') {
      throw new Error(`DB verification failed. Found fcmToken=${updatedUser?.fcmToken}`);
    }
    console.log(`   ✅ Device FCM token verified in PostgreSQL database: ${updatedUser.fcmToken} (${updatedUser.devicePlatform})\n`);

    // -------------------------------------------------------------------------
    // 3. Test NotificationsService Dispatch
    // -------------------------------------------------------------------------
    console.log('🔔 3. Testing NotificationsService.sendToUser...');
    const dispatched = await notificationsService.sendToUser(customerId, {
      title: 'Order Status Update',
      body: 'Your food is now being prepared by Sultan\'s Dine!',
      data: { orderId: 'test-order-uuid', status: 'PREPARING' },
    });
    if (!dispatched) throw new Error('sendToUser returned false');
    console.log('   ✅ Push notification dispatch successfully processed without errors!\n');

    // -------------------------------------------------------------------------
    // 4. Test Dispatch Escalation Logic
    // -------------------------------------------------------------------------
    console.log('⚡ 4. Testing Dispatch Timeout Escalation Engine...');
    // Create an unassigned order with placedAt 100 seconds ago (exceeding 90s Tier 1 timeout)
    const testVendor = await prisma.vendor.findFirst({ select: { id: true, name: true } });
    if (!testVendor) throw new Error('No vendor found for testing');

    const simulatedPlacedAt = new Date(Date.now() - 100 * 1000);
    const escalationOrder = await prisma.order.create({
      data: {
        orderNumber: 'ORD-ESCALATE-001',
        customerId,
        vendorId: testVendor.id,
        status: OrderStatus.PLACED,
        riderId: null,
        subtotal: 350.0,
        deliveryFee: 50.0,
        totalAmount: 400.0,
        paymentMethod: 'CASH_ON_DELIVERY',
        paymentStatus: 'PENDING',
        deliveryAddressSnapshot: { addressLine: 'Road 11, Banani, Dhaka' },
        customerPhoneSnapshot: '+8801700000005',
        placedAt: simulatedPlacedAt,
      },
    });

    console.log(`   Created test aging order ${escalationOrder.orderNumber} (placed ${simulatedPlacedAt.toISOString()})`);

    // Clear any previous escalation keys in Redis
    await redis.del(`dispatch:escalated:${escalationOrder.id}:tier1`);
    await redis.del(`dispatch:escalated:${escalationOrder.id}:tier2`);

    // Run escalation evaluation
    await orderFlowService.evaluateDispatchEscalations();

    // Verify Tier 1 key exists in Redis
    const tier1Key = await redis.get(`dispatch:escalated:${escalationOrder.id}:tier1`);
    if (tier1Key !== '1') {
      throw new Error('Tier 1 escalation Redis flag was not set!');
    }
    console.log('   ✅ Tier 1 Escalation triggered: radius expansion to 6km verified in Redis!');

    // Now test Tier 2 escalation (simulating 200 seconds aging > 180s)
    await prisma.order.update({
      where: { id: escalationOrder.id },
      data: { placedAt: new Date(Date.now() - 200 * 1000) },
    });

    await orderFlowService.evaluateDispatchEscalations();

    const tier2Key = await redis.get(`dispatch:escalated:${escalationOrder.id}:tier2`);
    if (tier2Key !== '1') {
      throw new Error('Tier 2 escalation Redis flag was not set!');
    }
    console.log('   ✅ Tier 2 Escalation triggered: high-priority admin alert verified in Redis!\n');

    // Clean up test order & redis keys
    await redis.del(`dispatch:escalated:${escalationOrder.id}:tier1`);
    await redis.del(`dispatch:escalated:${escalationOrder.id}:tier2`);
    await prisma.order.delete({ where: { id: escalationOrder.id } });
    console.log('   🧹 Test order and Redis keys cleaned up.');

    console.log('\n====================================================');
    console.log(' 🎉 FCM & Dispatch Escalation Verification PASSED!');
    console.log('====================================================\n');
  } finally {
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

runFcmAndEscalationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
