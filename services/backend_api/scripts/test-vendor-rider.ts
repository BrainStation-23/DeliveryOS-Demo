import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';

async function runVendorRiderTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Vendor Staff & Rider Management Tests');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4095;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  const prisma = app.get(PrismaService);

  try {
    // Prior runs can leave the courier with a stale in-flight order (the DB
    // busy backstop would then refuse new claims) — cancel the leftovers so
    // the suite starts from a clean trip.
    const seededCourier = await prisma.rider.findFirst({
      where: { user: { phone: '+8801700000004' } },
    });
    if (seededCourier) {
      await prisma.order.updateMany({
        where: {
          riderId: seededCourier.id,
          status: { in: ['RIDER_ASSIGNED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date(), riderId: null },
      });
      // Prior suites may leak the Redis busy marker as well.
      const { RedisService } = await import('../src/common/redis/redis.service');
      app.get(RedisService).del(`rider:active_order:${seededCourier.id}`);
      // Repeated suite runs accumulate collected COD cash until the (correct)
      // claim-time cash-limit guard blocks new COD claims — reset the wallet.
      await prisma.rider.update({
        where: { id: seededCourier.id },
        data: { cashInHand: 0 },
      });
    }

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
    const branchManager = await login('+8801700000002'); // Gulshan Branch Manager
    const brandOwner = await login('+8801700000003');    // Master Franchise Owner
    const rider = await login('+8801700000004');         // Delivery Rider
    const customer = await login('+8801700000005');      // Customer
    console.log('   ✅ All stakeholders authenticated.\n');

    // Outlets & Products
    const gulshanOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'Gulshan Branch' } },
      include: { products: true },
    });
    const dhanmondiOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'Dhanmondi Branch' } },
      include: { products: true },
    });
    const freshmartOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'FreshMart' } },
      include: { products: true },
    });

    if (!gulshanOutlet || !dhanmondiOutlet || !freshmartOutlet) {
      throw new Error('Outlets not found in database');
    }

    const gulshanProduct = gulshanOutlet.products[0];
    const freshmartProduct = freshmartOutlet.products[0];

    // -------------------------------------------------------------------------
    // Test 1: Vendor Staff Permission Boundary (PARTICULAR_OUTLET)
    // -------------------------------------------------------------------------
    console.log('🛡️  1. Testing PARTICULAR_OUTLET Scope Enforcement...');

    // Branch manager tries to toggle stock on FreshMart product -> Should throw 403
    const unauthorizedStockRes = await fetch(`${baseUrl}/vendor/products/${freshmartProduct.id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({ isInStock: false }),
    });
    const unauthorizedStockJson = await unauthorizedStockRes.json();
    console.log(`   Branch Manager -> FreshMart Product: status=${unauthorizedStockRes.status}, message="${unauthorizedStockJson.message}"`);
    if (unauthorizedStockRes.status !== 403) {
      throw new Error('Expected 403 Forbidden when managing outside assigned outlet');
    }

    // Branch manager queries live orders specifying unauthorized outlet -> Should throw 403
    const unauthorizedOrdersRes = await fetch(`${baseUrl}/vendor/orders/live?vendorId=${freshmartOutlet.id}`, {
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const unauthorizedOrdersJson = await unauthorizedOrdersRes.json();
    console.log(`   Branch Manager -> FreshMart Live Orders: status=${unauthorizedOrdersRes.status}, message="${unauthorizedOrdersJson.message}"`);
    if (unauthorizedOrdersRes.status !== 403) {
      throw new Error('Expected 403 Forbidden when accessing live orders for unassigned outlet');
    }
    console.log('   ✅ Particular outlet manager correctly blocked from foreign outlets!\n');

    // -------------------------------------------------------------------------
    // Test 2: Master Brand Owner Permission (ALL_OUTLETS_MASTER)
    // -------------------------------------------------------------------------
    console.log('👑 2. Testing ALL_OUTLETS_MASTER Scope...');

    // Brand owner queries live orders for Gulshan -> Should succeed (200)
    const brandGulshanOrdersRes = await fetch(`${baseUrl}/vendor/orders/live?vendorId=${gulshanOutlet.id}`, {
      headers: { Authorization: `Bearer ${brandOwner.token}` },
    });
    console.log(`   Brand Owner -> Gulshan Orders: status=${brandGulshanOrdersRes.status}`);
    if (brandGulshanOrdersRes.status !== 200) {
      throw new Error('Expected 200 OK for Brand Owner accessing sister branch Gulshan');
    }

    // Brand owner queries live orders for Dhanmondi -> Should succeed (200)
    const brandDhanmondiOrdersRes = await fetch(`${baseUrl}/vendor/orders/live?vendorId=${dhanmondiOutlet.id}`, {
      headers: { Authorization: `Bearer ${brandOwner.token}` },
    });
    console.log(`   Brand Owner -> Dhanmondi Orders: status=${brandDhanmondiOrdersRes.status}`);
    if (brandDhanmondiOrdersRes.status !== 200) {
      throw new Error('Expected 200 OK for Brand Owner accessing sister branch Dhanmondi');
    }

    // Brand owner tries to toggle stock on FreshMart (different brand) -> Should fail 403
    const brandFreshmartRes = await fetch(`${baseUrl}/vendor/products/${freshmartProduct.id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brandOwner.token}`,
      },
      body: JSON.stringify({ isInStock: false }),
    });
    console.log(`   Brand Owner -> FreshMart Product (Unowned Brand): status=${brandFreshmartRes.status}`);
    if (brandFreshmartRes.status !== 403) {
      throw new Error('Expected 403 Forbidden for Brand Owner accessing another brand outlet');
    }
    console.log('   ✅ Multi-branch Brand Owner permissions verified!\n');

    // -------------------------------------------------------------------------
    // Test 3: Instant Stock Toggle
    // -------------------------------------------------------------------------
    console.log('📦 3. Testing Instant Stock Toggle...');
    // Toggle Out of Stock
    const outOfStockRes = await fetch(`${baseUrl}/vendor/products/${gulshanProduct.id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({ isInStock: false }),
    });
    const outOfStockJson = await outOfStockRes.json();
    console.log(`   Set Out-of-Stock: status=${outOfStockRes.status}, isInStock=${outOfStockJson.data?.isInStock}`);
    if (outOfStockRes.status !== 200 || outOfStockJson.data?.isInStock !== false) {
      throw new Error('Failed to set product out of stock');
    }

    // Toggle Back In Stock
    const inStockRes = await fetch(`${baseUrl}/vendor/products/${gulshanProduct.id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({ isInStock: true }),
    });
    const inStockJson = await inStockRes.json();
    console.log(`   Set Back In-Stock: status=${inStockRes.status}, isInStock=${inStockJson.data?.isInStock}`);
    if (inStockRes.status !== 200 || inStockJson.data?.isInStock !== true) {
      throw new Error('Failed to restore product in stock');
    }
    console.log('   ✅ Instant stock toggle verified!\n');

    // -------------------------------------------------------------------------
    // Test 4: Order Acceptance with Default Prep Time
    // -------------------------------------------------------------------------
    console.log('⏱️  4. Testing Order Acceptance with Default Prep Time...');

    // Create a customer order at Gulshan branch
    const address = await prisma.customerAddress.findFirst({
      where: { userId: customer.userId, isDefault: true },
    });
    const orderRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: address?.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [{ productId: gulshanProduct.id, quantity: 1 }],
      }),
    });
    const orderJson = await orderRes.json();
    if (orderRes.status !== 201 || !orderJson.data?.orderId) {
      throw new Error(`Failed to place order: ${JSON.stringify(orderJson)}`);
    }
    const testOrderId = orderJson.data.orderId;
    console.log(`   Placed Order: ${orderJson.data.orderNumber} (ID: ${testOrderId})`);

    // Dhanmondi Manager (or someone from wrong outlet) cannot accept Gulshan order
    // Let's create an order at Dhanmondi to verify Branch Manager cannot accept it
    const dhanmondiOrder = await prisma.order.create({
      data: {
        orderNumber: `ORD-DH-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: customer.userId,
        vendorId: dhanmondiOutlet.id,
        status: 'PLACED',
        subtotal: 300,
        deliveryFee: 50,
        totalAmount: 350,
        paymentMethod: 'CASH_ON_DELIVERY',
        paymentStatus: 'PENDING',
        deliveryAddressSnapshot: { address: 'Test' },
        customerPhoneSnapshot: '+8801700000005',
      },
    });

    const rejectAcceptRes = await fetch(`${baseUrl}/vendor/orders/${dhanmondiOrder.id}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({}),
    });
    console.log(`   Branch Manager accepting Dhanmondi order: status=${rejectAcceptRes.status}`);
    if (rejectAcceptRes.status !== 403) {
      throw new Error('Expected 403 Forbidden when Branch Manager attempts to accept another branch order');
    }

    // -------------------------------------------------------------------------
    // Test 4: RIDER_FIRST accept guard, courier claim, then kitchen accept
    // -------------------------------------------------------------------------
    console.log('🛡️  4. Testing RIDER_FIRST accept guard + claim-to-accept sequence...');

    // 4a. Courier must be online before claiming
    const dutyRes = await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider.token}`,
      },
      body: JSON.stringify({ isOnline: true }),
    });
    const dutyJson = await dutyRes.json();
    console.log(`   Rider Duty Response: status=${dutyRes.status}, isOnline=${dutyJson.data?.isOnline}`);
    if (dutyRes.status !== 200 || dutyJson.data?.isOnline !== true) {
      throw new Error('Failed to toggle rider duty');
    }

    // 4b. RIDER_FIRST invariant: the kitchen cannot accept a PLACED order
    // before a courier secures it (it would strand the order in PREPARING).
    const blockedAcceptRes = await fetch(`${baseUrl}/vendor/orders/${testOrderId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({}),
    });
    console.log(`   Blocked PLACED accept: status=${blockedAcceptRes.status}`);
    if (blockedAcceptRes.status !== 409) {
      throw new Error(
        `Expected 409 when accepting a PLACED order in RIDER_FIRST mode, received ${blockedAcceptRes.status}`,
      );
    }
    console.log('   ✅ Kitchen accept correctly withheld until a courier secures the order!');

    // 4c. Courier claims the broadcast order (atomic Redis mutex + DB backstop)
    const riderRow = await prisma.rider.findFirst({ where: { userId: rider.userId } });
    if (!riderRow) {
      throw new Error('Seeded rider profile not found for the courier login');
    }
    const claimRes = await fetch(`${baseUrl}/rider/orders/${testOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    const claimJson = await claimRes.json();
    console.log(`   Rider Claim: status=${claimRes.status}, orderStatus=${claimJson.data?.status}`);
    if (claimRes.status !== 200 || claimJson.data?.riderId !== riderRow.id) {
      throw new Error(`Failed to claim order: ${JSON.stringify(claimJson)}`);
    }
    console.log('   ✅ Rider secured the order (RIDER_ASSIGNED)!');

    // 4d. Branch Manager accepts without prepTimeMinutes
    const acceptRes = await fetch(`${baseUrl}/vendor/orders/${testOrderId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({}), // Omit prepTimeMinutes -> should use default (20 mins)
    });
    const acceptJson = await acceptRes.json();
    console.log(`   Accept Response: status=${acceptRes.status}, prepTime=${acceptJson.data?.prepTimeMinutes}, orderStatus=${acceptJson.data?.status}`);
    if (
      acceptRes.status !== 200 ||
      acceptJson.data?.status !== 'PREPARING' ||
      acceptJson.data?.prepTimeMinutes !== gulshanOutlet.defaultPrepTimeMinutes
    ) {
      throw new Error(
        `Default prep time not correctly applied! Expected ${gulshanOutlet.defaultPrepTimeMinutes}, got ${acceptJson.data?.prepTimeMinutes}`,
      );
    }
    console.log('   ✅ Order accepted with outlet default prep time!\n');

    // -------------------------------------------------------------------------
    // Test 5: Kitchen Ready & Handover Status Progression
    // -------------------------------------------------------------------------
    console.log('🍳 5. Testing Kitchen Ready & Handover Workflow...');

    // Mark Ready
    const readyRes = await fetch(`${baseUrl}/vendor/orders/${testOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const readyJson = await readyRes.json();
    console.log(`   Ready Response: status=${readyRes.status}, orderStatus=${readyJson.data?.status}`);
    if (readyRes.status !== 200 || readyJson.data?.status !== 'READY_FOR_PICKUP') {
      throw new Error('Failed to mark order ready for pickup');
    }

    // Handover
    const handoverRes = await fetch(`${baseUrl}/vendor/orders/${testOrderId}/handover`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const handoverJson = await handoverRes.json();
    console.log(`   Handover Response: status=${handoverRes.status}, orderStatus=${handoverJson.data?.status}`);
    if (handoverRes.status !== 200 || handoverJson.data?.status !== 'DISPATCHED') {
      throw new Error('Failed to handover order');
    }
    console.log('   ✅ Kitchen ready & handover state transitions verified!\n');

    // Free the courier for the next test: the DB in-flight backstop blocks a
    // second claim while a trip is open.
    const completeRes = await fetch(`${baseUrl}/rider/orders/${testOrderId}/deliver`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider.token}`,
      },
      body: JSON.stringify({ codCashCollected: true }),
    });
    if (completeRes.status !== 200) {
      throw new Error('Failed to complete the first trip before starting the second');
    }
    console.log('   ✅ First trip completed; courier released for the next dispatch.\n');

    // -------------------------------------------------------------------------
    // Test 6: Rider Duty & COD Delivery Lifecycle
    // -------------------------------------------------------------------------
    console.log('🛵 6. Testing Rider Duty & COD Delivery Settlement...');

    // Confirm the duty state is sticky across the flow.
    const dutyCheckRes = await fetch(`${baseUrl}/rider/profile`, {
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    const dutyCheckJson = await dutyCheckRes.json();
    if (dutyCheckRes.status !== 200 || dutyCheckJson.data?.isOnline !== true) {
      throw new Error('Rider duty state was not retained across the flow');
    }
    console.log('   ✅ Rider duty state retained (online).');

    // Create a fresh COD order for rider delivery test
    const codOrderRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: address?.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [{ productId: gulshanProduct.id, quantity: 1 }],
      }),
    });
    const codOrderJson = await codOrderRes.json();
    const codOrderId = codOrderJson.data.orderId;
    const orderTotal = codOrderJson.data.totalAmount;

    // Courier claims the fresh dispatch, THEN the kitchen accepts and marks ready
    const claim2Res = await fetch(`${baseUrl}/rider/orders/${codOrderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    if (claim2Res.status !== 200) {
      throw new Error(`Rider failed to claim the second order: ${JSON.stringify(await claim2Res.json())}`);
    }
    await fetch(`${baseUrl}/vendor/orders/${codOrderId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchManager.token}`,
      },
      body: JSON.stringify({ prepTimeMinutes: 15 }),
    });
    await fetch(`${baseUrl}/vendor/orders/${codOrderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });

    // Rider picks up order
    const pickupRes = await fetch(`${baseUrl}/rider/orders/${codOrderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider.token}` },
    });
    const pickupJson = await pickupRes.json();
    console.log(`   Rider Pickup: status=${pickupRes.status}, orderStatus=${pickupJson.data?.status}`);
    if (pickupRes.status !== 200 || pickupJson.data?.status !== 'DISPATCHED') {
      throw new Error('Failed to confirm pickup by rider');
    }

    // Record initial rider cash
    const riderBefore = await prisma.rider.findFirst({ where: { userId: rider.userId } });
    const initialCash = Number(riderBefore?.cashInHand || 0);

    // Rider confirms delivery with COD cash collected
    const deliverRes = await fetch(`${baseUrl}/rider/orders/${codOrderId}/deliver`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider.token}`,
      },
      body: JSON.stringify({
        codCashCollected: true,
        amountCollected: orderTotal,
      }),
    });
    const deliverJson = await deliverRes.json();
    console.log(`   Rider Delivery: status=${deliverRes.status}, orderStatus=${deliverJson.data?.order?.status}`);
    if (deliverRes.status !== 200 || deliverJson.data?.order?.status !== 'DELIVERED') {
      throw new Error('Failed to deliver order');
    }

    // Verify Rider Cash In Hand
    const riderAfter = await prisma.rider.findFirst({ where: { userId: rider.userId } });
    const updatedCash = Number(riderAfter?.cashInHand || 0);
    console.log(`   Rider Cash In Hand: ${initialCash} BDT -> ${updatedCash} BDT (Collected: ${orderTotal} BDT)`);
    if (updatedCash !== initialCash + orderTotal) {
      throw new Error('Rider cash in hand not incremented correctly');
    }

    // Verify RiderTripLedger
    const tripLedger = await prisma.riderTripLedger.findUnique({
      where: { orderId: codOrderId },
    });
    if (!tripLedger) {
      throw new Error('Rider trip ledger was not created');
    }
    console.log(`   Trip Ledger: Delivery Earnings = ${tripLedger.deliveryEarnings} BDT, COD Collected = ${tripLedger.codCollected} BDT`);
    if (Number(tripLedger.codCollected) !== orderTotal) {
      throw new Error('Trip ledger COD collected amount mismatch');
    }
    console.log('   ✅ Rider duty, order pickup, and COD cash reconciliation verified!\n');

    console.log('====================================================');
    console.log(' 🎉 All Vendor Staff & Rider Tests Passed!');
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

runVendorRiderTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
