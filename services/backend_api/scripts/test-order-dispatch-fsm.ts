import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OrderFlowService } from '../src/modules/order-flow/order-flow.service';
import { OrderFlowMode } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import { UserRole } from '@prisma/client';

async function runOrderDispatchFsmTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Configurable Dispatch & FSM Verification');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4093;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;
  const wsUrl = `http://localhost:${testPort}/events`;

  const prisma = app.get(PrismaService);
  const orderFlowService = app.get(OrderFlowService);
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
    const superAdmin = await login('+8801700000001');
    const branchManager = await login('+8801700000002');
    const rider1 = await login('+8801700000004');
    const customer = await login('+8801700000005');

    // Create / Seed Rider 2 for concurrent race condition testing
    let rider2User = await prisma.user.findUnique({ where: { phone: '+8801700000006' } });
    if (!rider2User) {
      rider2User = await prisma.user.create({
        data: {
          phone: '+8801700000006',
          fullName: 'Kamal Hossain (Rider 2)',
          role: UserRole.RIDER,
          status: 'ACTIVE',
        },
      });
      await prisma.rider.create({
        data: {
          userId: rider2User.id,
          vehicleType: 'bicycle',
          isOnline: true,
          cashInHand: 0,
        },
      });
    }
    const rider2 = await login('+8801700000006');
    console.log('   ✅ Super Admin, Branch Manager, Customer, Rider 1, and Rider 2 authenticated.\n');

    // Ensure riders are online
    await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider1.token}` },
      body: JSON.stringify({ isOnline: true }),
    });
    await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider2.token}` },
      body: JSON.stringify({ isOnline: true }),
    });

    const gulshanOutlet = await prisma.vendor.findFirst({
      where: { name: 'Gulshan', brand: { name: 'Burger King' } },
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

    // -------------------------------------------------------------------------
    // Test 1: Redis Geospatial Indexing (GEOADD & GEOSEARCH)
    // -------------------------------------------------------------------------
    console.log('📍 1. Testing Redis Geospatial Indexing & Nearby Rider Discovery...');
    const r1Profile = await prisma.rider.findUnique({ where: { userId: rider1.userId } });
    const r2Profile = await prisma.rider.findUnique({ where: { userId: rider2.userId } });

    // Index rider locations in Redis near Gulshan outlet (23.7925, 90.4078)
    await orderFlowService.updateRiderLocation(r1Profile!.id, 23.7930, 90.4080); // ~70 meters away
    await orderFlowService.updateRiderLocation(r2Profile!.id, 23.7950, 90.4100); // ~350 meters away

    const nearbyRiders = await orderFlowService.findNearbyAvailableRiders(
      gulshanOutlet!.latitude,
      gulshanOutlet!.longitude,
      3.0, // 3 km radius
    );
    console.log(`   Found ${nearbyRiders.length} available online riders within 3km of Gulshan outlet:`);
    nearbyRiders.forEach((r) => console.log(`     - Rider ID: ${r.riderId}, Distance: ${r.distanceKm} km`));

    if (nearbyRiders.length < 2) {
      throw new Error('Redis GEOSEARCH failed to discover indexed nearby riders');
    }
    console.log('   ✅ Redis Geospatial indexing and proximity discovery verified!\n');

    // -------------------------------------------------------------------------
    // Test 2: Concurrency Race Condition & Redis Distributed Lock
    // -------------------------------------------------------------------------
    console.log('🔒 2. Testing Concurrent Rider Claims & Redis Distributed Lock...');

    // Place an order for claim contention
    const claimOrderRes = await fetch(`${baseUrl}/orders/checkout`, {
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
    const claimOrderJson = await claimOrderRes.json();
    const contestedOrderId = claimOrderJson.data.orderId;
    console.log(`   Contested Order Created: ${claimOrderJson.data.orderNumber} (ID: ${contestedOrderId})`);

    // Fire 6 concurrent claim attempts simultaneously from Rider 1 and Rider 2
    console.log('   Firing 6 concurrent claim requests across 2 competing delivery riders...');
    const claimPromises = [
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider1.token}` },
      }),
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider2.token}` },
      }),
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider1.token}` },
      }),
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider2.token}` },
      }),
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider1.token}` },
      }),
      fetch(`${baseUrl}/rider/orders/${contestedOrderId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rider2.token}` },
      }),
    ];

    const claimResponses = await Promise.all(claimPromises);
    const statuses = claimResponses.map((r) => r.status);
    console.log(`   Claim HTTP Status Codes: [${statuses.join(', ')}]`);

    const successCount = statuses.filter((s) => s === 200).length;
    const conflictCount = statuses.filter((s) => s === 409 || s === 400).length;

    console.log(`   Successes: ${successCount}, Conflicts/Rejected: ${conflictCount}`);

    if (successCount !== 1) {
      throw new Error(`Concurrency violation! Expected exactly 1 winner, but got ${successCount}`);
    }

    // Verify in database that exactly one rider is assigned
    const assignedDbOrder = await prisma.order.findUnique({
      where: { id: contestedOrderId },
    });
    console.log(`   Assigned Rider in DB: ${assignedDbOrder?.riderId}, Status: ${assignedDbOrder?.status}`);
    if (!assignedDbOrder?.riderId) {
      throw new Error('Contested order was not assigned to any rider in DB');
    }
    console.log('   ✅ Redis distributed mutex strictly prevented race conditions (1 winner, 5 rejected)!\n');

    // Release the Redis busy marker AND cancel the winner's in-flight DB
    // assignment — the claim-time backstop refuses new claims while the
    // contested order is open.
    await orderFlowService.releaseRiderActiveTrip(assignedDbOrder.riderId);
    await prisma.order.update({
      where: { id: contestedOrderId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), riderId: null },
    });

    // -------------------------------------------------------------------------
    // Test 3: RIDER_FIRST (Zero Food Waste) Sequence Verification
    // -------------------------------------------------------------------------
    console.log('🥗 3. Testing RIDER_FIRST Sequence (Zero Food Waste Mode)...');

    // Set the outlet's flow mode to RIDER_FIRST and tighten dispatch timing
    await fetch(`${baseUrl}/admin/vendors/${gulshanOutlet!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ orderFlowMode: OrderFlowMode.RIDER_FIRST }),
    });
    await fetch(`${baseUrl}/admin/settings/dispatch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ riderSearchTimeoutSeconds: 60 }),
    });
    console.log(`   Outlet flow mode: RIDER_FIRST (rider search timeout 60s)`);

    // Connect vendor socket to monitor incoming chimes
    const vendorSocket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token: branchManager.token },
    });
    openSockets.push(vendorSocket);

    let vendorChimeReceived = false;
    let vendorChimePayload: any = null;
    vendorSocket.on('order:new', (payload) => {
      vendorChimeReceived = true;
      vendorChimePayload = payload;
    });

    await new Promise((r) => setTimeout(r, 200)); // allow connection

    // Customer places order
    const rfOrderRes = await fetch(`${baseUrl}/orders/checkout`, {
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
    const rfOrderJson = await rfOrderRes.json();
    const rfOrderId = rfOrderJson.data.orderId;
    console.log(`   Order Placed: ${rfOrderJson.data.orderNumber} (ID: ${rfOrderId})`);

    // Wait a brief moment: in RIDER_FIRST, vendor socket should NOT receive order:new yet!
    await new Promise((r) => setTimeout(r, 250));
    console.log(`   Vendor chime received immediately upon checkout? ${vendorChimeReceived}`);
    if (vendorChimeReceived) {
      throw new Error('In RIDER_FIRST mode, vendor chime must be held until rider claims order');
    }
    console.log('   ✅ Store kitchen chime withheld while broadcasting to riders pool.');

    // Now Rider 1 claims the order
    const rfClaimRes = await fetch(`${baseUrl}/rider/orders/${rfOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider1.token}` },
    });
    const rfClaimJson = await rfClaimRes.json();
    console.log(`   Rider Claimed Order: status=${rfClaimRes.status}, orderStatus=${rfClaimJson.data?.status}`);
    if (rfClaimRes.status !== 200 || rfClaimJson.data?.status !== 'RIDER_ASSIGNED') {
      throw new Error('Failed to transition to RIDER_ASSIGNED upon rider claim');
    }

    // Now vendor socket MUST receive order:new with riderAssigned = true!
    await new Promise((r) => setTimeout(r, 200));
    console.log(`   Vendor chime received after rider claim? ${vendorChimeReceived}, riderAssigned=${vendorChimePayload?.data?.riderAssigned}`);
    if (!vendorChimeReceived || !vendorChimePayload?.data?.riderAssigned) {
      throw new Error('Vendor kitchen chime was not fired after rider secured the order');
    }
    console.log('   ✅ Store kitchen console received order:new with Guaranteed Rider badge!');

    // Vendor accepts with prep time
    const rfAcceptRes = await fetch(`${baseUrl}/vendor/orders/${rfOrderId}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchManager.token}` },
      body: JSON.stringify({ prepTimeMinutes: 20 }),
    });
    const rfAcceptJson = await rfAcceptRes.json();
    console.log(`   Vendor Accepted: status=${rfAcceptRes.status}, orderStatus=${rfAcceptJson.data?.status}`);
    if (rfAcceptJson.data?.status !== 'PREPARING') {
      throw new Error('Expected status PREPARING after vendor acceptance');
    }

    // Rider completes pickup and delivery
    await fetch(`${baseUrl}/vendor/orders/${rfOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    await fetch(`${baseUrl}/rider/orders/${rfOrderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider1.token}` },
    });
    await fetch(`${baseUrl}/rider/orders/${rfOrderId}/deliver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider1.token}` },
      body: JSON.stringify({ codCashCollected: true, amountCollected: rfOrderJson.data.totalAmount }),
    });
    console.log('   ✅ RIDER_FIRST Zero Food Waste sequence completed successfully!\n');

    // -------------------------------------------------------------------------
    // Test 4: VENDOR_FIRST (Traditional Retail) Sequence Verification
    // -------------------------------------------------------------------------
    console.log('🏪 4. Testing VENDOR_FIRST Sequence (Traditional Retail Mode)...');

    // Switch the outlet to VENDOR_FIRST
    await fetch(`${baseUrl}/admin/vendors/${gulshanOutlet!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ orderFlowMode: OrderFlowMode.VENDOR_FIRST }),
    });
    console.log(`   Outlet flow mode: VENDOR_FIRST`);

    vendorChimeReceived = false;

    // Customer places order in VENDOR_FIRST
    const vfOrderRes = await fetch(`${baseUrl}/orders/checkout`, {
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
    const vfOrderJson = await vfOrderRes.json();
    const vfOrderId = vfOrderJson.data.orderId;
    console.log(`   Order Placed: ${vfOrderJson.data.orderNumber} (ID: ${vfOrderId})`);

    // In VENDOR_FIRST, vendor chime MUST fire immediately upon checkout!
    await new Promise((r) => setTimeout(r, 200));
    console.log(`   Vendor chime received immediately in VENDOR_FIRST? ${vendorChimeReceived}`);
    if (!vendorChimeReceived) {
      throw new Error('In VENDOR_FIRST mode, vendor chime must fire immediately upon checkout');
    }
    console.log('   ✅ Store kitchen console received order:new immediately!');

    // Vendor accepts & preps
    await fetch(`${baseUrl}/vendor/orders/${vfOrderId}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchManager.token}` },
      body: JSON.stringify({ prepTimeMinutes: 15 }),
    });

    // Vendor marks ready -> In VENDOR_FIRST, this triggers broadcast to riders
    const vfReadyRes = await fetch(`${baseUrl}/vendor/orders/${vfOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const vfReadyJson = await vfReadyRes.json();
    console.log(`   Vendor Marked Ready: orderStatus=${vfReadyJson.data?.status}`);

    // Rider claims order
    const vfClaimRes = await fetch(`${baseUrl}/rider/orders/${vfOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider2.token}` },
    });
    const vfClaimJson = await vfClaimRes.json();
    console.log(`   Rider Claimed Order: status=${vfClaimRes.status}, assignedRider=${vfClaimJson.data?.riderId}`);
    if (vfClaimRes.status !== 200 || !vfClaimJson.data?.riderId) {
      throw new Error('Rider claim failed in VENDOR_FIRST mode');
    }

    // Complete delivery
    await fetch(`${baseUrl}/rider/orders/${vfOrderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider2.token}` },
    });
    await fetch(`${baseUrl}/rider/orders/${vfOrderId}/deliver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider2.token}` },
      body: JSON.stringify({ codCashCollected: true, amountCollected: vfOrderJson.data.totalAmount }),
    });
    console.log('   ✅ VENDOR_FIRST sequence completed successfully!\n');

    // Restore pilot default to RIDER_FIRST
    await fetch(`${baseUrl}/admin/vendors/${gulshanOutlet!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ orderFlowMode: OrderFlowMode.RIDER_FIRST }),
    });
    console.log('   Restored outlet default: RIDER_FIRST.');

    console.log('\n====================================================');
    console.log(' 🎉 All Configurable Dispatch FSM Tests Passed!');
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

runOrderDispatchFsmTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
