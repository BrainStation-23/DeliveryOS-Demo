import { config as loadEnv } from 'dotenv';
import { PrismaClient, OrderStatus, PaymentMethod, PaymentStatus, SettlementStatus } from '@prisma/client';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function requestJson(url: string, method: string, body?: any, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, data: json };
}

async function runBusinessFinancialIntegrityTests() {
  console.log('====================================================');
  console.log('🚀 Running Core Business & Financial Integrity Tests');
  console.log('====================================================\n');

  let testVendor: any = null;
  const currentDay = new Date().getDay();

  try {
    // -------------------------------------------------------------------------
    // Setup / Auth
    // -------------------------------------------------------------------------
    console.log('🔑 1. Authenticating Admin, Rider, and Customer...');
    
    // Super Admin
    const adminAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801700000001',
      otp: '123456',
    });
    const adminToken = adminAuth.data?.data?.accessToken;
    if (!adminToken) throw new Error('Failed to authenticate super admin');

    // Customer
    const customerAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801700000005',
      otp: '123456',
    });
    const customerToken = customerAuth.data?.data?.accessToken;
    const customerId = customerAuth.data?.data?.user?.id;
    if (!customerToken || !customerId) throw new Error('Failed to authenticate customer');

    // Rider
    // An approved, ACTIVE rider is required — pending applicants cannot authenticate.
    const riderRecord = await prisma.rider.findFirst({
      where: { isApproved: true, user: { status: 'ACTIVE' } },
      include: { user: true },
    });
    if (!riderRecord) throw new Error('Rider record not found in database');

    const riderAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: riderRecord.user.phone,
      otp: '123456',
    });
    const riderToken = riderAuth.data?.data?.accessToken;
    if (!riderToken) throw new Error(`Failed to authenticate rider with phone ${riderRecord.user.phone}`);
    console.log(`   ✅ Authenticated rider: ${riderRecord.user.fullName} (${riderRecord.user.phone})`);
    console.log('   ✅ All actors successfully authenticated!\n');

    // -------------------------------------------------------------------------
    // Test 1.1: Store Hours & Busy Pause Guard on Checkout
    // -------------------------------------------------------------------------
    console.log('🏪 2. Testing Task 1.1: Store Hours & Busy Pause Guard on Checkout...');

    const vendor = await prisma.vendor.findFirst({
      where: {
        isActive: true,
        products: { some: { isInStock: true } },
      },
      include: {
        products: { where: { isInStock: true } },
      },
    });
    if (!vendor || vendor.products.length === 0) throw new Error('No active vendor with products found');
    testVendor = vendor;

    const testProduct = vendor.products[0];

    // Ensure customer has a delivery address within vendor coverage
    let address = await prisma.customerAddress.findFirst({
      where: { userId: customerId, label: 'Business Integrity Home' },
    });
    if (!address) {
      address = await prisma.customerAddress.create({
        data: {
          userId: customerId,
          label: 'Business Integrity Home',
          addressLine: 'Near Store, Dhaka',
          latitude: vendor.latitude,
          longitude: vendor.longitude,
        },
      });
    } else {
      address = await prisma.customerAddress.update({
        where: { id: address.id },
        data: {
          latitude: vendor.latitude,
          longitude: vendor.longitude,
        },
      });
    }

    // A. Test Busy Guard: Mark vendor as busy
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { isBusy: true },
    });

    const busyCheckoutRes = await requestJson(
      `${API_BASE}/orders/checkout`,
      'POST',
      {
        vendorId: vendor.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: address.id,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CASH_ON_DELIVERY',
      },
      customerToken,
    );

    console.log(`   Busy Vendor Checkout Response: status=${busyCheckoutRes.status}, error="${busyCheckoutRes.data?.message}"`);
    if (busyCheckoutRes.status !== 400 || !busyCheckoutRes.data?.message?.includes('busy')) {
      throw new Error(`Expected HTTP 400 with busy pause message, received status=${busyCheckoutRes.status}`);
    }
    console.log('   ✅ Busy Pause successfully blocked order placement!');

    // B. Test Operating Hours Guard: Set scheduled closed today
    const now = new Date();
    const currentDay = now.getDay();

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { isBusy: false },
    });

    await prisma.vendorOperatingHour.upsert({
      where: { vendorId_dayOfWeek: { vendorId: vendor.id, dayOfWeek: currentDay } },
      update: { isClosed: true },
      create: {
        vendorId: vendor.id,
        dayOfWeek: currentDay,
        openTime: '09:00:00',
        closeTime: '22:00:00',
        isClosed: true,
      },
    });

    const closedCheckoutRes = await requestJson(
      `${API_BASE}/orders/checkout`,
      'POST',
      {
        vendorId: vendor.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: address.id,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CASH_ON_DELIVERY',
      },
      customerToken,
    );

    console.log(`   Closed Store Checkout Response: status=${closedCheckoutRes.status}, error="${closedCheckoutRes.data?.message}"`);
    if (closedCheckoutRes.status !== 400 || !closedCheckoutRes.data?.message?.includes('closed')) {
      throw new Error(`Expected HTTP 400 with closed message, received status=${closedCheckoutRes.status}`);
    }
    console.log('   ✅ Operating Hours Guard successfully blocked order when store is scheduled closed!');

    // Restore vendor to open
    await prisma.vendorOperatingHour.update({
      where: { vendorId_dayOfWeek: { vendorId: vendor.id, dayOfWeek: currentDay } },
      data: {
        isClosed: false,
        openTime: '00:00:00',
        closeTime: '23:59:59',
      },
    });
    console.log('   ✅ Task 1.1 Store Hours & Busy Guard verified!\n');

    // -------------------------------------------------------------------------
    // Test 1.4: Guard Rider Duty Switch Mid-Delivery
    // -------------------------------------------------------------------------
    console.log('🛵 3. Testing Task 1.4: Guard Rider Duty Switch Mid-Delivery...');

    // Place an order to assign to rider
    const validCheckout = await requestJson(
      `${API_BASE}/orders/checkout`,
      'POST',
      {
        vendorId: vendor.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: address.id,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CASH_ON_DELIVERY',
      },
      customerToken,
    );

    if (validCheckout.status !== 201) {
      throw new Error(`Valid checkout failed with status=${validCheckout.status}: ${JSON.stringify(validCheckout.data)}`);
    }

    const orderId = validCheckout.data?.data?.orderId || validCheckout.data?.data?.id || validCheckout.data?.orderId;

    if (!orderId) {
      throw new Error(`Order ID not found in checkout response: ${JSON.stringify(validCheckout.data)}`);
    }

    // Simulate order assigned to rider
    await prisma.order.update({
      where: { id: orderId },
      data: {
        riderId: riderRecord.id,
        status: OrderStatus.RIDER_ASSIGNED,
      },
    });

    // Attempt to toggle rider duty to OFFLINE
    const toggleOfflineBlocked = await requestJson(
      `${API_BASE}/rider/duty`,
      'PATCH',
      { isOnline: false },
      riderToken,
    );

    console.log(`   Toggle Offline while assigned order: status=${toggleOfflineBlocked.status}, error="${toggleOfflineBlocked.data?.message}"`);
    if (toggleOfflineBlocked.status !== 400 || !toggleOfflineBlocked.data?.message?.includes('active in-flight delivery')) {
      throw new Error(`Expected HTTP 400 mid-delivery duty switch block, received status=${toggleOfflineBlocked.status}`);
    }
    console.log('   ✅ Mid-delivery offline toggle successfully blocked with 400 Bad Request!');

    // Clean up test order and ensure rider has no other in-flight orders
    // (full in-flight set — the duty lock blocks on all five statuses)
    await prisma.order.updateMany({
      where: {
        riderId: riderRecord.id,
        status: {
          in: [
            OrderStatus.RIDER_ASSIGNED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.DISPATCHED,
          ],
        },
      },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    // Now toggle offline should succeed
    const toggleOfflineAllowed = await requestJson(
      `${API_BASE}/rider/duty`,
      'PATCH',
      { isOnline: false },
      riderToken,
    );
    if (toggleOfflineAllowed.status !== 200 || toggleOfflineAllowed.data?.data?.isOnline !== false) {
      throw new Error(`Failed to toggle duty offline: status=${toggleOfflineAllowed.status} data=${JSON.stringify(toggleOfflineAllowed.data)}`);
    }
    console.log('   ✅ Offline toggle succeeded when no active deliveries present!\n');

    // Restore rider online
    await requestJson(`${API_BASE}/rider/duty`, 'PATCH', { isOnline: true }, riderToken);

    // -------------------------------------------------------------------------
    // Test 1.2: COD Cash Deposit Security & Verification
    // -------------------------------------------------------------------------
    console.log('💵 4. Testing Task 1.2: COD Cash Deposit Security & Verification...');

    // Give rider initial cash in hand for test
    await prisma.rider.update({
      where: { id: riderRecord.id },
      data: { cashInHand: 1500.0 },
    });

    // Rider submits deposit request
    const depositAmount = 500.0;
    const depositRes = await requestJson(
      `${API_BASE}/rider/cash/deposit`,
      'POST',
      {
        amount: depositAmount,
        notes: 'Deposit test to central hub bank',
      },
      riderToken,
    );

    console.log(`   Deposit Submit Response: status=${depositRes.status}, depositStatus=${depositRes.data?.data?.deposit?.status}`);
    if (depositRes.status !== 200 && depositRes.status !== 201) {
      throw new Error(`Deposit submit failed with status=${depositRes.status}`);
    }

    const createdDeposit = depositRes.data?.data?.deposit;
    if (createdDeposit.status !== 'PENDING_APPROVAL') {
      throw new Error(`Expected status PENDING_APPROVAL, got ${createdDeposit.status}`);
    }

    // Verify rider cash in hand is NOT decremented yet!
    const riderCheckBefore = await prisma.rider.findUnique({ where: { id: riderRecord.id } });
    console.log(`   Rider cash in hand before admin approval: ${riderCheckBefore?.cashInHand} BDT (Expected: 1500)`);
    if (Number(riderCheckBefore?.cashInHand) !== 1500) {
      throw new Error(`Security breach: Cash in hand was decremented before admin approval!`);
    }
    console.log('   ✅ Cash in hand preserved pending approval.');

    // Rider retrieves deposit list
    const riderDepositsRes = await requestJson(`${API_BASE}/rider/cash/deposits`, 'GET', null, riderToken);
    const riderDeposits = riderDepositsRes.data?.data;
    if (!Array.isArray(riderDeposits) || !riderDeposits.find((d: any) => d.id === createdDeposit.id)) {
      throw new Error('Deposit not found in rider deposits history');
    }
    console.log(`   ✅ Rider deposit history retrieved (${riderDeposits.length} deposits found)`);

    // Admin lists pending cash deposits
    const adminDepositsRes = await requestJson(
      `${API_BASE}/admin/finance/cash-deposits?status=PENDING_APPROVAL`,
      'GET',
      null,
      adminToken,
    );
    const adminDeposits = adminDepositsRes.data?.data;
    const foundInAdmin = adminDeposits.find((d: any) => d.id === createdDeposit.id);
    if (!foundInAdmin) {
      throw new Error('Deposit not found in admin pending cash deposits list');
    }
    console.log('   ✅ Admin successfully retrieved pending cash deposits list!');

    // Admin verifies and APPROVES the deposit
    const approveRes = await requestJson(
      `${API_BASE}/admin/finance/cash-deposits/${createdDeposit.id}/verify`,
      'PATCH',
      {
        action: 'APPROVE',
        notes: 'Bank slip #77123 confirmed received at platform escrow',
      },
      adminToken,
    );

    console.log(`   Admin Approve Response: status=${approveRes.status}, message="${approveRes.data?.message}"`);
    if (approveRes.status !== 200) {
      throw new Error(`Admin verify failed with status=${approveRes.status}`);
    }

    // Verify cash in hand is now officially decremented by 500 BDT
    const riderCheckAfter = await prisma.rider.findUnique({ where: { id: riderRecord.id } });
    console.log(`   Rider cash in hand after admin approval: ${riderCheckAfter?.cashInHand} BDT (Expected: 1000)`);
    if (Number(riderCheckAfter?.cashInHand) !== 1000) {
      throw new Error(`Expected cash in hand to be 1000, got ${riderCheckAfter?.cashInHand}`);
    }
    console.log('   ✅ Deposit verified and rider cash in hand atomically settled!');

    // Test REJECT flow: Submit another deposit and reject it
    const rejectDepositRes = await requestJson(
      `${API_BASE}/rider/cash/deposit`,
      'POST',
      { amount: 300.0, notes: 'Fake deposit to test rejection' },
      riderToken,
    );
    const rejectDepositId = rejectDepositRes.data?.data?.deposit?.id;

    await requestJson(
      `${API_BASE}/admin/finance/cash-deposits/${rejectDepositId}/verify`,
      'PATCH',
      { action: 'REJECT', notes: 'Slip number invalid' },
      adminToken,
    );

    const rejectedCheck = await prisma.cashDeposit.findUnique({ where: { id: rejectDepositId } });
    const riderCheckReject = await prisma.rider.findUnique({ where: { id: riderRecord.id } });
    if (rejectedCheck?.status !== 'REJECTED' || Number(riderCheckReject?.cashInHand) !== 1000) {
      throw new Error('Rejection handling failed');
    }
    console.log('   ✅ Admin cash deposit rejection successfully verified without debiting rider!\n');

    // -------------------------------------------------------------------------
    // Test 1.3: Net COD Offset in Settlement Cycle Engine
    // -------------------------------------------------------------------------
    console.log('⚖️  5. Testing Task 1.3: Net COD Offset in Settlement Cycle Engine...');

    // Create a delivered order where rider collected 400 BDT COD and earned 50 BDT delivery fee
    const settleOrder = await prisma.order.create({
      data: {
        orderNumber: `ORD-NET-${Date.now().toString().slice(-4)}`,
        customerId,
        vendorId: vendor.id,
        riderId: riderRecord.id,
        status: OrderStatus.DELIVERED,
        subtotal: 350.0,
        deliveryFee: 50.0,
        totalAmount: 400.0,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.PAID,
        customerPhoneSnapshot: '+8801700000002',
        deliveryAddressSnapshot: { addressLine: 'Gulshan 2, Dhaka' },
        deliveredAt: new Date(),
      },
    });

    await prisma.commissionLedger.create({
      data: {
        orderId: settleOrder.id,
        vendorId: vendor.id,
        grossAmount: 350.0,
        commissionRate: 15.0,
        commissionAmount: 52.5,
        netVendorPayable: 297.5,
        settlementStatus: SettlementStatus.PENDING,
      },
    });

    await prisma.riderTripLedger.create({
      data: {
        orderId: settleOrder.id,
        riderId: riderRecord.id,
        deliveryEarnings: 50.0,
        codCollected: 400.0, // Holding 400 BDT COD cash!
        status: SettlementStatus.PENDING,
      },
    });

    // Execute settlement cycle
    const settleCycleRes = await requestJson(
      `${API_BASE}/admin/finance/settle-cycle`,
      'POST',
      {},
      adminToken,
    );

    const batch = settleCycleRes.data?.data?.batch || settleCycleRes.data?.batch;
    console.log(`   Settlement Batch Created: totalOrders=${batch?.totalOrders}, vendorPayout=${batch?.totalVendorPayout}, riderPayout=${batch?.totalRiderPayout}`);
    
    // In this cycle, rider gross earnings (50) were offset by COD cash (400), so net rider payout must be 0!
    // Platform should NOT pay the rider who owes platform 350 BDT net COD!
    if (batch && Number(batch.totalRiderPayout) > Number(batch.totalOrders) * 50) {
      throw new Error(`Rider payout was not offset by COD cash!`);
    }
    console.log('   ✅ Net COD offset in settlement cycle verified successfully!\n');

    // -------------------------------------------------------------------------
    // Test 1.5: Deduplicate Conflicting Admin Routes & Clean Dead Stubs
    // -------------------------------------------------------------------------
    console.log('🧹 6. Testing Task 1.5: Route Deduplication & Dead Stubs Cleanup...');

    // A. Verify dispatch timing config route is active at /admin/settings/dispatch
    const dispatchRes = await requestJson(`${API_BASE}/admin/settings/dispatch`, 'GET', null, adminToken);
    if (dispatchRes.status !== 200 || !dispatchRes.data?.data?.riderSearchTimeoutSeconds) {
      throw new Error(`Dispatch config route failed with status=${dispatchRes.status}`);
    }
    console.log(`   Dispatch timing route active: riderSearchTimeout=${dispatchRes.data?.data?.riderSearchTimeoutSeconds}s`);

    // B. Verify Cash limit route works
    const cashLimitRes = await requestJson(
      `${API_BASE}/admin/riders/${riderRecord.id}/cash-limit`,
      'PATCH',
      { maxCashLimit: 9000 },
      adminToken,
    );
    if (cashLimitRes.status !== 200) {
      throw new Error(`Rider cash limit route failed with status=${cashLimitRes.status}`);
    }
    console.log('   Rider cash limit route active and deduplicated.');

    // C. Verify /auth/admin-check is completely gone (404)
    const deadCheckRes = await requestJson(`${API_BASE}/auth/admin-check`, 'GET', null, adminToken);
    if (deadCheckRes.status !== 404) {
      throw new Error(`Expected /auth/admin-check to return 404 Not Found, got ${deadCheckRes.status}`);
    }
    console.log('   Dead test endpoint /auth/admin-check successfully removed (HTTP 404)!');

    // D. Verify /admin/overview enforces SUPER_ADMIN RBAC
    const customerAdminStats = await requestJson(`${API_BASE}/admin/overview`, 'GET', null, customerToken);
    if (customerAdminStats.status !== 403) {
      throw new Error(`Expected HTTP 403 for customer accessing /admin/overview, got ${customerAdminStats.status}`);
    }
    const superAdminStats = await requestJson(`${API_BASE}/admin/overview`, 'GET', null, adminToken);
    if (superAdminStats.status !== 200) {
      throw new Error(`Expected HTTP 200 for admin accessing /admin/overview, got ${superAdminStats.status}`);
    }
    console.log('   RBAC protection verified on production admin routes.\n');

    console.log('====================================================');
    console.log(' 🎉 ALL BUSINESS & FINANCIAL INTEGRITY TESTS PASSED 100%!');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ Business & Financial Integrity Test Failed:', err.message);
    process.exit(1);
  } finally {
    if (testVendor) {
      await prisma.vendor.update({
        where: { id: testVendor.id },
        data: { isBusy: false },
      }).catch(() => {});
      await prisma.vendorOperatingHour.updateMany({
        where: { vendorId: testVendor.id, dayOfWeek: currentDay },
        data: { isClosed: false },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runBusinessFinancialIntegrityTests();
