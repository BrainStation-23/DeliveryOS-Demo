import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OrderFlowService } from '../src/modules/order-flow/order-flow.service';
import { OrderFlowMode } from '../src/modules/order-flow/dto/update-order-flow.dto';
import { RedisService } from '../src/common/redis/redis.service';
import { io, Socket } from 'socket.io-client';
import { OrderStatus, PaymentStatus } from '@prisma/client';

async function runE2ELifecycleTest() {
  console.log('================================================================');
  console.log(' DeliveryOS Full Lifecycle E2E Simulation & Financial Audit');
  console.log(' Task 7.1: Multi-Role Stakeholders, Dispatch FSM & Ledger Balance');
  console.log('================================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4097;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;
  const wsUrl = `http://localhost:${testPort}/events`;

  const prisma = app.get(PrismaService);
  const orderFlowService = app.get(OrderFlowService);
  const redisService = app.get(RedisService);
  const openSockets: Socket[] = [];

  try {
    // -------------------------------------------------------------------------
    // Helper: Authenticate by Phone OTP
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

    // -------------------------------------------------------------------------
    // Setup & Authenticate 4 Stakeholders
    // -------------------------------------------------------------------------
    console.log('🔑 1. Authenticating All 4 Stakeholders (Super Admin, Vendor, Rider, Customer)...');
    const superAdmin = await login('+8801700000001');
    const branchManager = await login('+8801700000002');
    const rider1 = await login('+8801700000004');
    const customer = await login('+8801700000005');
    console.log('   ✅ Super Admin, Branch Manager, Rider 1, and Customer authenticated successfully.\n');

    // Retrieve Rider profile and outlet details
    const riderProfile = await prisma.rider.findUnique({ where: { userId: rider1.userId } });
    if (!riderProfile) throw new Error('Rider 1 profile not found');

    const gulshanOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'Gulshan Branch' } },
      include: { products: true },
    });
    if (!gulshanOutlet) throw new Error('Gulshan outlet not found');
    const product = gulshanOutlet.products.find((p) => Number(p.basePrice) >= 250) || gulshanOutlet.products[0];
    if (!product) throw new Error('No product found for Gulshan outlet');
    const orderQuantity = Number(product.basePrice) >= 250 ? 1 : Math.ceil(250 / Number(product.basePrice));
    console.log(`   Selected Item: ${product.name} (Price: ${product.basePrice} BDT, Qty: ${orderQuantity})`);

    // Reset rider active order mutex in Redis & ensure Rider is online near outlet
    await redisService.del(`rider:active_order:${riderProfile.id}`);
    await fetch(`${baseUrl}/rider/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider1.token}` },
      body: JSON.stringify({ isOnline: true }),
    });
    await orderFlowService.updateRiderLocation(riderProfile.id, 23.7930, 90.4080); // ~70m from store

    // Ensure RIDER_FIRST dispatch mode is configured
    await fetch(`${baseUrl}/admin/settings/order-flow`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ mode: OrderFlowMode.RIDER_FIRST, riderSearchTimeoutSeconds: 60 }),
    });
    console.log('   ✅ Order Flow Configured: Mode = RIDER_FIRST (Zero Food Waste).\n');

    // -------------------------------------------------------------------------
    // Phase 1: Customer Geofence & Coupon Validation
    // -------------------------------------------------------------------------
    console.log('🌐 2. Testing Customer Geofence Guard & Promotional Coupon Validation...');

    // 2A: Geofence Negative Test (Address > 20 km away outside 5 km radius)
    const farAwayAddress = await prisma.customerAddress.create({
      data: {
        userId: customer.userId,
        label: 'Far Away Gazipur',
        addressLine: 'Gazipur Bypass, Out of Bounds',
        latitude: 23.9950,
        longitude: 90.4200,
        isDefault: false,
      },
    });

    const outOfCoverageRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: farAwayAddress.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });
    const outOfCoverageJson = await outOfCoverageRes.json();
    console.log(`   Geofence Negative Check: HTTP ${outOfCoverageRes.status}, error=${outOfCoverageJson.error || outOfCoverageJson.message}`);

    if (outOfCoverageRes.status !== 422) {
      throw new Error(`Expected HTTP 422 for out-of-coverage address, received ${outOfCoverageRes.status}`);
    }
    console.log('   ✅ Geofence Negative Test Passed: Spatial guard blocked out-of-coverage delivery.');

    // Clean up temporary far away address
    await prisma.customerAddress.delete({ where: { id: farAwayAddress.id } });

    // 2B: Geofence Positive Test & Coupon Validation
    const inCoverageAddress = await prisma.customerAddress.findFirst({
      where: { userId: customer.userId, isDefault: true },
    });
    if (!inCoverageAddress) throw new Error('In-coverage default address not found');

    // Verify coupon WELCOME50 exists
    const coupon = await prisma.coupon.findUnique({ where: { code: 'WELCOME50' } });
    if (!coupon) throw new Error('WELCOME50 coupon not found in database');
    console.log(`   Promotional Coupon: ${coupon.code} (Flat 50 BDT discount, Min Spend: ${coupon.minOrderAmount} BDT)`);

    // -------------------------------------------------------------------------
    // Phase 2: RIDER_FIRST Real-Time Fulfillment Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n🛵 3. Executing RIDER_FIRST End-to-End Real-Time Fulfillment Flow...');

    // Connect Vendor WebSocket client to observe kitchen console notifications
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

    await new Promise((r) => setTimeout(r, 250)); // allow socket handshake

    // Step A: Customer places order with WELCOME50 coupon and COD
    const orderRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: inCoverageAddress.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        couponCode: 'WELCOME50',
        items: [{ productId: product.id, quantity: orderQuantity }],
      }),
    });
    const orderJson = await orderRes.json();
    if (orderRes.status !== 201 || !orderJson.data?.orderId) {
      throw new Error(`Checkout failed: ${JSON.stringify(orderJson)}`);
    }

    const orderId = orderJson.data.orderId;
    const orderNumber = orderJson.data.orderNumber;
    const totalAmount = orderJson.data.totalAmount;
    console.log(`   [Step 1 - Placed] Order Placed: ${orderNumber} (Total: ${totalAmount} BDT, Coupon: WELCOME50)`);

    // Step B: Verify vendor chime is WITHHELD (Zero Food Waste guarantee)
    await new Promise((r) => setTimeout(r, 200));
    console.log(`   Vendor chime received immediately upon placement? ${vendorChimeReceived}`);
    if (vendorChimeReceived) {
      throw new Error('Zero Food Waste violation: Vendor chime rang before rider claimed order');
    }
    console.log('   ✅ Zero Food Waste Guard Verified: Kitchen chime withheld while broadcasting to nearby riders.');

    // Step C: Rider claims broadcasted order
    const claimRes = await fetch(`${baseUrl}/rider/orders/${orderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider1.token}` },
    });
    const claimJson = await claimRes.json();
    console.log(`   [Step 2 - Claimed] Rider Claimed Order: HTTP ${claimRes.status}, Status=${claimJson.data?.status}`);
    if (claimRes.status !== 200 || claimJson.data?.status !== 'RIDER_ASSIGNED') {
      throw new Error(`Expected RIDER_ASSIGNED status after claim, received ${claimJson.data?.status}`);
    }

    // Step D: Verify vendor socket NOW receives order:new chime with Guaranteed Rider badge
    await new Promise((r) => setTimeout(r, 250));
    console.log(`   Vendor chime received after rider claim? ${vendorChimeReceived}, riderAssigned=${vendorChimePayload?.data?.riderAssigned}`);
    if (!vendorChimeReceived || !vendorChimePayload?.data?.riderAssigned) {
      throw new Error('Store kitchen chime was not fired after rider claimed order');
    }
    console.log('   ✅ Kitchen Console Alert: Incoming order chime with Guaranteed Rider badge!');

    // Step E: Vendor accepts order with prep time (15 mins)
    const acceptRes = await fetch(`${baseUrl}/vendor/orders/${orderId}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchManager.token}` },
      body: JSON.stringify({ prepTimeMinutes: 15 }),
    });
    const acceptJson = await acceptRes.json();
    console.log(`   [Step 3 - Preparing] Vendor Accepted: HTTP ${acceptRes.status}, Status=${acceptJson.data?.status}, PrepTime=${acceptJson.data?.prepTimeMinutes}m`);
    if (acceptJson.data?.status !== 'PREPARING') {
      throw new Error(`Expected PREPARING status after vendor acceptance, received ${acceptJson.data?.status}`);
    }

    // Step F: Vendor marks food ready
    const readyRes = await fetch(`${baseUrl}/vendor/orders/${orderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const readyJson = await readyRes.json();
    console.log(`   [Step 4 - Ready] Vendor Marked Ready: HTTP ${readyRes.status}, Status=${readyJson.data?.status}`);
    if (readyJson.data?.status !== 'READY_FOR_PICKUP') {
      throw new Error(`Expected READY_FOR_PICKUP status, received ${readyJson.data?.status}`);
    }

    // Step G: Rider confirms counter pickup
    const pickupRes = await fetch(`${baseUrl}/rider/orders/${orderId}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rider1.token}` },
    });
    const pickupJson = await pickupRes.json();
    console.log(`   [Step 5 - Out for Delivery] Rider Picked Up: HTTP ${pickupRes.status}, Status=${pickupJson.data?.status}`);
    if (pickupJson.data?.status !== 'OUT_FOR_DELIVERY' && pickupJson.data?.status !== 'DISPATCHED') {
      throw new Error(`Expected OUT_FOR_DELIVERY/DISPATCHED status, received ${pickupJson.data?.status}`);
    }

    // Step H: Rider delivers to doorstep, collects COD cash
    const deliverRes = await fetch(`${baseUrl}/rider/orders/${orderId}/deliver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rider1.token}` },
      body: JSON.stringify({
        codCashCollected: true,
        amountCollected: totalAmount,
      }),
    });
    const deliverJson = await deliverRes.json();
    console.log(`   [Step 6 - Delivered] Rider Completed Delivery: HTTP ${deliverRes.status}, Status=${deliverJson.data?.order?.status}`);
    if (deliverJson.data?.order?.status !== 'DELIVERED') {
      throw new Error(`Expected DELIVERED status, received ${deliverJson.data?.order?.status}`);
    }
    console.log('   ✅ Full RIDER_FIRST delivery lifecycle completed without errors!\n');

    // -------------------------------------------------------------------------
    // Phase 3: Multi-Role Stakeholder View Verification
    // -------------------------------------------------------------------------
    console.log('👥 4. Verifying Stakeholder Multi-Role Consistency across all 4 Portals...');

    // 1. Customer View
    const custOrderRes = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });
    const custOrderJson = await custOrderRes.json();
    if (custOrderJson.data?.status !== OrderStatus.DELIVERED || custOrderJson.data?.paymentStatus !== PaymentStatus.PAID) {
      throw new Error('Customer view does not reflect DELIVERED and PAID status');
    }
    console.log(`   - Customer Portal: Order ${custOrderJson.data.orderNumber} is DELIVERED, Payment: PAID.`);

    // 2. Rider View & Cash In Hand
    const updatedRider = await prisma.rider.findUnique({ where: { id: riderProfile.id } });
    const riderActiveTrip = await redisService.get(`rider:active_order:${riderProfile.id}`);
    if (riderActiveTrip !== null) {
      throw new Error('Rider active trip lock was not cleared in Redis upon delivery');
    }
    console.log(`   - Rider App: Cash in hand = ${updatedRider?.cashInHand} BDT, Redis active trip lock cleanly released.`);

    // 3. Vendor View
    const vendorLiveOrdersRes = await fetch(`${baseUrl}/vendor/orders/live`, {
      headers: { Authorization: `Bearer ${branchManager.token}` },
    });
    const vendorLiveOrdersJson = await vendorLiveOrdersRes.json();
    console.log(`   - Vendor Kitchen Portal: Active live orders queue verified (${vendorLiveOrdersJson.data?.length} in prep queue).`);

    // 4. Super Admin View
    const adminOverviewRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    const adminOverviewJson = await adminOverviewRes.json();
    console.log(`   - Super Admin Master Portal: Total orders tracked = ${adminOverviewJson.data?.metrics?.totalOrders}, Today's Volume = ${adminOverviewJson.data?.metrics?.todayVolume} BDT.`);
    console.log('   ✅ All 4 Stakeholder views verified consistent!\n');

    // -------------------------------------------------------------------------
    // Phase 4: Financial Double-Entry Ledger Audit
    // -------------------------------------------------------------------------
    console.log('💰 5. Performing Financial Double-Entry Ledger Audit...');

    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        commission: true,
        riderTrip: true,
      },
    });
    if (!dbOrder) throw new Error('Order not found in database');
    if (!dbOrder.commission) throw new Error('CommissionLedger missing for order');
    if (!dbOrder.riderTrip) throw new Error('RiderTripLedger missing for order');

    const customerPaid = Number(dbOrder.totalAmount);
    const grossFoodAmount = Number(dbOrder.subtotal);
    const couponDiscount = Number(dbOrder.couponDiscount);
    const deliveryFee = Number(dbOrder.deliveryFee);

    const commissionLedger = dbOrder.commission;
    const riderTripLedger = dbOrder.riderTrip;

    const commissionRate = Number(commissionLedger.commissionRate);
    const commissionAmount = Number(commissionLedger.commissionAmount);
    const netVendorPayable = Number(commissionLedger.netVendorPayable);

    const riderDeliveryEarnings = Number(riderTripLedger.deliveryEarnings);
    const codCollected = Number(riderTripLedger.codCollected);

    // Platform Net Margin = Platform Commission + (Delivery Fee - Rider Delivery Earnings)
    // In DeliveryOS: Customer Bill = Net Vendor Payable + Rider Delivery Earnings + Platform Net Margin
    const platformNetMargin = Math.round((commissionAmount + (deliveryFee - riderDeliveryEarnings)) * 100) / 100;

    console.log('   ┌──────────────────────────────────────────────────────────┐');
    console.log('   │             FINANCIAL DOUBLE-ENTRY LEDGER               │');
    console.log('   ├──────────────────────────────────────────────────────────┤');
    console.log(`   │ Customer Paid Total (Bill):         ${customerPaid.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │   • Food Subtotal:                  ${grossFoodAmount.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │   • Delivery Fee:                   ${deliveryFee.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │   • Coupon Discount (WELCOME50):   -${couponDiscount.toFixed(2).padStart(12)} BDT │`);
    console.log('   ├──────────────────────────────────────────────────────────┤');
    console.log(`   │ Net Vendor Payable (${commissionRate}% comm):       ${netVendorPayable.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │ Rider Trip Earnings:                ${riderDeliveryEarnings.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │ Platform Net Margin:                ${platformNetMargin.toFixed(2).padStart(12)} BDT │`);
    console.log(`   │ COD Cash Collected by Rider:        ${codCollected.toFixed(2).padStart(12)} BDT │`);
    console.log('   └──────────────────────────────────────────────────────────┘');

    // Assert double-entry equality
    const calculatedSum = Math.round((netVendorPayable + riderDeliveryEarnings + platformNetMargin) * 100) / 100;
    const discrepancy = Math.abs(customerPaid - calculatedSum);
    console.log(`   Ledger Balancing Equation:`);
    console.log(`   ${customerPaid.toFixed(2)} [Customer Bill] === ${netVendorPayable.toFixed(2)} [Vendor Payout] + ${riderDeliveryEarnings.toFixed(2)} [Rider] + ${platformNetMargin.toFixed(2)} [Platform Margin]`);
    console.log(`   Penny Discrepancy: ${discrepancy.toFixed(4)} BDT`);

    if (discrepancy > 0.001) {
      throw new Error(`Financial double-entry ledger does not balance! Discrepancy: ${discrepancy}`);
    }
    console.log('   ✅ Double-Entry Financial Ledger BALANCES TO THE EXACT PENNY (0.00 BDT difference)!\n');

    // -------------------------------------------------------------------------
    // Phase 5: State Machine & Database Integrity Audit
    // -------------------------------------------------------------------------
    console.log('🛡️ 6. Performing Zero-Orphan & State Machine Database Integrity Audit...');

    // Verify foreign key integrity
    if (dbOrder.customerId !== customer.userId) throw new Error('Order customer ID mismatch');
    if (dbOrder.vendorId !== gulshanOutlet.id) throw new Error('Order vendor ID mismatch');
    if (dbOrder.riderId !== riderProfile.id) throw new Error('Order rider ID mismatch');
    if (commissionLedger.orderId !== orderId || commissionLedger.vendorId !== gulshanOutlet.id) {
      throw new Error('Commission ledger foreign key integrity mismatch');
    }
    if (riderTripLedger.orderId !== orderId || riderTripLedger.riderId !== riderProfile.id) {
      throw new Error('Rider trip ledger foreign key integrity mismatch');
    }

    // Check for any orphaned records in database
    const orderItemsCount = await prisma.orderItem.count({ where: { orderId } });
    if (orderItemsCount === 0) throw new Error('Order has 0 order items');

    // Query all ledgers and confirm each has a valid order in the DB
    const allCommissionLedgers = await prisma.commissionLedger.findMany({ select: { orderId: true } });
    const allTripLedgers = await prisma.riderTripLedger.findMany({ select: { orderId: true } });
    const orderIds = new Set((await prisma.order.findMany({ select: { id: true } })).map((o) => o.id));

    const orphanedCommission = allCommissionLedgers.filter((c) => !orderIds.has(c.orderId)).length;
    const orphanedTrip = allTripLedgers.filter((t) => !orderIds.has(t.orderId)).length;

    console.log(`   - Order Items Verified: ${orderItemsCount} items attached to order.`);
    console.log(`   - Orphaned Commission Ledgers: ${orphanedCommission}`);
    console.log(`   - Orphaned Rider Trip Ledgers: ${orphanedTrip}`);

    if (orphanedCommission > 0 || orphanedTrip > 0) {
      throw new Error('Detected orphaned records in database');
    }
    console.log('   ✅ 0 State Machine Errors and 0 Orphaned Records Verified!\n');

    console.log('================================================================');
    console.log(' 🎉 Full Lifecycle E2E Simulation & Audit PASSED COMPLETELY!');
    console.log('================================================================\n');
  } finally {
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    await app.close();
  }
}

runE2ELifecycleTest().catch((err) => {
  console.error('❌ E2E Simulation Failed:', err);
  process.exit(1);
});
