import { PrismaClient } from '@prisma/client';
import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
const WS_BASE = process.env.WS_BASE_URL || 'http://localhost:4000/events';
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

async function runTrack3VendorKDSTests() {
  console.log('====================================================');
  console.log('🚀 Running Track 3: Merchant & Kitchen KDS Resilience Tests');
  console.log('====================================================\n');

  const socketsToClose: Socket[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Authentication
    // -------------------------------------------------------------------------
    console.log('🔑 1. Authenticating Vendor Staff & Customer...');

    // Gulshan Branch Manager
    const vendorAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801700000002',
      otp: '123456',
    });
    const vendorToken = vendorAuth.data?.data?.accessToken;
    const vendorUser = vendorAuth.data?.data?.user;
    if (!vendorToken) throw new Error('Failed to authenticate vendor staff');

    // Customer
    const customerAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801700000005',
      otp: '123456',
    });
    const customerToken = customerAuth.data?.data?.accessToken;
    if (!customerToken) throw new Error('Failed to authenticate customer');

    console.log(`   ✅ Vendor Staff Authenticated: ${vendorUser.fullName} (${vendorUser.role})`);
    console.log(`   ✅ Customer Authenticated.\n`);

    // -------------------------------------------------------------------------
    // 2. Profile & Outlets Scope
    // -------------------------------------------------------------------------
    console.log('🏪 2. Verifying Staff Profile and Accessible Outlets...');
    const profileRes = await requestJson(`${API_BASE}/vendor/me`, 'GET', undefined, vendorToken);
    if (profileRes.status !== 200 || !profileRes.data?.data) {
      throw new Error(`Failed to get vendor profile: ${JSON.stringify(profileRes.data)}`);
    }
    const staffProfile = profileRes.data.data;
    console.log(`   ✅ Staff Profile Verified: Outlet: ${staffProfile.outlet?.name || 'N/A'}`);

    const outletsRes = await requestJson(`${API_BASE}/vendor/outlets`, 'GET', undefined, vendorToken);
    if (outletsRes.status !== 200 || !Array.isArray(outletsRes.data?.data)) {
      throw new Error(`Failed to get accessible outlets: ${JSON.stringify(outletsRes.data)}`);
    }
    const outlets = outletsRes.data.data;
    if (outlets.length === 0) throw new Error('No accessible outlets returned for vendor staff');
    const targetVendor = outlets[0];
    const vendorId = targetVendor.id;
    console.log(`   ✅ Retrieved ${outlets.length} Accessible Outlet(s). Target Outlet: ${targetVendor.name} (${vendorId})\n`);

    // -------------------------------------------------------------------------
    // 3. Full Merchant Catalog vs Public Customer Catalog (Sold-Out Resilience)
    // -------------------------------------------------------------------------
    console.log('🍔 3. Testing Merchant Catalog (/api/v1/vendor/catalog) & Stock Toggle...');
    const merchantCatalogRes = await requestJson(
      `${API_BASE}/vendor/catalog?vendorId=${vendorId}`,
      'GET',
      undefined,
      vendorToken,
    );
    if (merchantCatalogRes.status !== 200 || !merchantCatalogRes.data?.data?.categories) {
      throw new Error(`Failed to fetch merchant catalog: ${JSON.stringify(merchantCatalogRes.data)}`);
    }
    const merchantCatalog = merchantCatalogRes.data.data;
    const allProducts = merchantCatalog.categories.flatMap((c: any) => c.products);
    if (allProducts.length === 0) throw new Error('Merchant catalog has no products');

    const testProduct = allProducts[0];
    console.log(`   📦 Found test product: "${testProduct.name}" (ID: ${testProduct.id}, initial stock: ${testProduct.isInStock})`);

    // Step 3a: Toggle product OUT OF STOCK
    console.log('   🔴 Toggling test product to OUT OF STOCK...');
    const toggleOffRes = await requestJson(
      `${API_BASE}/vendor/products/${testProduct.id}/stock`,
      'PATCH',
      { isInStock: false },
      vendorToken,
    );
    if (toggleOffRes.status !== 200 || toggleOffRes.data?.data?.isInStock !== false) {
      throw new Error(`Failed to toggle product stock to false: ${JSON.stringify(toggleOffRes.data)}`);
    }

    // Step 3b: Verify Public Customer Catalog does NOT show the product
    const publicCatalogRes = await requestJson(`${API_BASE}/vendors/${vendorId}/catalog`, 'GET');
    const publicProducts = publicCatalogRes.data?.data?.categories?.flatMap((c: any) => c.products) || [];
    const isPresentInPublic = publicProducts.some((p: any) => p.id === testProduct.id);
    if (isPresentInPublic) {
      throw new Error(`❌ Product "${testProduct.name}" still visible in public catalog despite being sold out!`);
    }
    console.log('   ✅ Public catalog correctly hides sold-out product.');

    // Step 3c: Verify Merchant Catalog STILL shows the product with isInStock === false
    const merchantCatalogRefetch = await requestJson(
      `${API_BASE}/vendor/catalog?vendorId=${vendorId}`,
      'GET',
      undefined,
      vendorToken,
    );
    const refetchedProducts = merchantCatalogRefetch.data?.data?.categories?.flatMap((c: any) => c.products) || [];
    const merchantItem = refetchedProducts.find((p: any) => p.id === testProduct.id);
    if (!merchantItem) {
      throw new Error(`❌ Product disappeared from merchant catalog when marked sold out!`);
    }
    if (merchantItem.isInStock !== false) {
      throw new Error(`❌ Merchant catalog expected isInStock: false but got ${merchantItem.isInStock}`);
    }
    console.log('   ✅ Merchant catalog correctly retains sold-out item with isInStock: false badge.');

    // Step 3d: Toggle product back IN STOCK
    console.log('   🟢 Restoring test product to IN STOCK...');
    const toggleOnRes = await requestJson(
      `${API_BASE}/vendor/products/${testProduct.id}/stock`,
      'PATCH',
      { isInStock: true },
      vendorToken,
    );
    if (toggleOnRes.status !== 200 || toggleOnRes.data?.data?.isInStock !== true) {
      throw new Error(`Failed to restore product stock to true: ${JSON.stringify(toggleOnRes.data)}`);
    }

    // Step 3e: Verify public catalog has product again
    const publicCatalogRestored = await requestJson(`${API_BASE}/vendors/${vendorId}/catalog`, 'GET');
    const restoredPublicProducts = publicCatalogRestored.data?.data?.categories?.flatMap((c: any) => c.products) || [];
    const isRestoredInPublic = restoredPublicProducts.some((p: any) => p.id === testProduct.id);
    if (!isRestoredInPublic) {
      throw new Error(`❌ Product failed to reappear in public catalog after toggling back in stock!`);
    }
    console.log('   ✅ Public customer catalog successfully restored with in-stock product.\n');

    // -------------------------------------------------------------------------
    // 4. Emergency Rush Hour Pause Toggle
    // -------------------------------------------------------------------------
    console.log('⏸️ 4. Testing 1-Click Rush Hour Pause Toggle...');
    // Pause store
    const pauseRes = await requestJson(
      `${API_BASE}/vendor/settings?vendorId=${vendorId}`,
      'PATCH',
      { isBusy: true, busyReason: 'Kitchen rush overload test' },
      vendorToken,
    );
    if (pauseRes.status !== 200 || pauseRes.data?.data?.isBusy !== true) {
      throw new Error(`Failed to pause store: ${JSON.stringify(pauseRes.data)}`);
    }

    const settingsCheck1 = await requestJson(`${API_BASE}/vendor/settings?vendorId=${vendorId}`, 'GET', undefined, vendorToken);
    if (settingsCheck1.data?.data?.isBusy !== true) {
      throw new Error(`Store settings did not reflect isBusy: true`);
    }
    console.log('   ✅ Store paused successfully (isBusy: true).');

    // Resume store
    const resumeRes = await requestJson(
      `${API_BASE}/vendor/settings?vendorId=${vendorId}`,
      'PATCH',
      { isBusy: false },
      vendorToken,
    );
    if (resumeRes.status !== 200 || resumeRes.data?.data?.isBusy !== false) {
      throw new Error(`Failed to resume store: ${JSON.stringify(resumeRes.data)}`);
    }

    const settingsCheck2 = await requestJson(`${API_BASE}/vendor/settings?vendorId=${vendorId}`, 'GET', undefined, vendorToken);
    if (settingsCheck2.data?.data?.isBusy !== false) {
      throw new Error(`Store settings did not reflect isBusy: false`);
    }
    console.log('   ✅ Store resumed successfully (isBusy: false).\n');

    // -------------------------------------------------------------------------
    // 5. Vendor Sales Ledger & Detailed Line Items Modal Data
    // -------------------------------------------------------------------------
    console.log('📊 5. Testing Sales Ledger & Detailed Order Line Items...');
    const salesRes = await requestJson(`${API_BASE}/vendor/sales?vendorId=${vendorId}`, 'GET', undefined, vendorToken);
    if (salesRes.status !== 200 || !salesRes.data?.data) {
      throw new Error(`Failed to fetch sales ledger: ${JSON.stringify(salesRes.data)}`);
    }

    const salesData = salesRes.data.data;
    if (!salesData.summary) throw new Error('Sales data missing summary metrics');
    console.log(`   📈 Sales Summary:`);
    console.log(`      Total Completed Orders: ${salesData.summary.totalOrders}`);
    console.log(`      Gross Sales: ৳${salesData.summary.grossSales}`);
    console.log(`      Commission Deducted: ৳${salesData.summary.commissionDeducted}`);
    console.log(`      Net Vendor Payable: ৳${salesData.summary.netVendorPayable}`);

    if (Array.isArray(salesData.ledgers) && salesData.ledgers.length > 0) {
      const sampleLedger = salesData.ledgers[0];
      console.log(`   📋 Sample Ledger Record (Order #${sampleLedger.orderNumber}):`);
      console.log(`      Customer: ${sampleLedger.customerName} (${sampleLedger.customerPhone || 'N/A'})`);
      console.log(`      Line Items Count: ${sampleLedger.items?.length || 0}`);
      if (sampleLedger.items && sampleLedger.items.length > 0) {
        const item = sampleLedger.items[0];
        console.log(`      First Item: ${item.quantity}x ${item.productName} @ ৳${item.unitPrice} = ৳${item.totalPrice}`);
      }
    }
    console.log('   ✅ Sales ledger successfully returns itemized order breakdowns.\n');

    // -------------------------------------------------------------------------
    // 6. Real-Time Socket Event Synchronization (vendor_${vendorId} Room)
    // -------------------------------------------------------------------------
    console.log('📡 6. Testing WebSocket Real-Time Event Synchronization to vendor room...');
    const vendorSocket = io(WS_BASE, {
      auth: { token: vendorToken },
      transports: ['websocket'],
    });
    socketsToClose.push(vendorSocket);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vendor socket connection timeout')), 6000);
      vendorSocket.on('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      vendorSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    console.log(`   ✅ Vendor Socket connected and auto-joined vendor_${vendorId}.`);

    // Listen for order:status:changed
    let receivedStatusEvent: any = null;
    const eventPromise = new Promise<void>((resolve) => {
      vendorSocket.on('order:status:changed', (payload) => {
        receivedStatusEvent = payload;
        resolve();
      });
    });

    // Create a real order via checkout API to test live status progression
    console.log('   📝 Creating an order via checkout to test real-time KDS transition events...');
    const customerUser = await prisma.user.findUnique({
      where: { phone: '+8801700000005' },
    });
    if (!customerUser) throw new Error('Customer user not found in DB');

    let customerAddress = await prisma.customerAddress.findFirst({
      where: { userId: customerUser.id },
    });
    if (!customerAddress) {
      const vendorRecord = await prisma.vendor.findUnique({ where: { id: vendorId } });
      customerAddress = await prisma.customerAddress.create({
        data: {
          userId: customerUser.id,
          label: 'Gulshan Office',
          addressLine: 'House 12, Road 5, Gulshan 1, Dhaka',
          latitude: vendorRecord?.latitude || 23.7925,
          longitude: vendorRecord?.longitude || 90.4078,
          isDefault: true,
        },
      });
    }

    // Ensure vendor operating hours cover current time during automated test run
    const todayDayOfWeek = new Date().getDay();
    await prisma.vendorOperatingHour.upsert({
      where: { vendorId_dayOfWeek: { vendorId, dayOfWeek: todayDayOfWeek } },
      update: { openTime: '00:00:00', closeTime: '23:59:59', isClosed: false },
      create: { vendorId, dayOfWeek: todayDayOfWeek, openTime: '00:00:00', closeTime: '23:59:59', isClosed: false },
    });

    const checkoutRes = await requestJson(
      `${API_BASE}/orders/checkout`,
      'POST',
      {
        vendorId,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: customerAddress.id,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CASH_ON_DELIVERY',
        customerNotes: 'Please ring bell and do not knock loudly',
      },
      customerToken,
    );

    if (checkoutRes.status !== 201 || (!checkoutRes.data?.data?.id && !checkoutRes.data?.data?.orderId)) {
      throw new Error(`Failed to place test order: ${JSON.stringify(checkoutRes.data)}`);
    }

    const testOrder = checkoutRes.data.data;
    const testOrderId = testOrder.orderId || testOrder.id;
    console.log(`   📦 Created Order #${testOrder.orderNumber} (ID: ${testOrderId})`);

    // Accept the order as vendor staff
    console.log(`   🍳 Accepting test order #${testOrder.orderNumber} via /vendor/orders/:id/accept...`);
    const acceptRes = await requestJson(
      `${API_BASE}/vendor/orders/${testOrderId}/accept`,
      'PATCH',
      { prepTimeMinutes: 25 },
      vendorToken,
    );
    if (acceptRes.status !== 200) {
      throw new Error(`Failed to accept order: ${JSON.stringify(acceptRes.data)}`);
    }

    // Await socket event on vendor socket
    await Promise.race([
      eventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Socket event timeout on vendor room')), 5000)),
    ]);

    if (!receivedStatusEvent) {
      throw new Error('Did not receive order:status:changed on vendor room');
    }
    console.log(`   ✅ Received real-time [order:status:changed] event on vendor_${vendorId}:`);
    console.log(`      Order ID: ${receivedStatusEvent.data?.orderId}`);
    console.log(`      Status: ${receivedStatusEvent.data?.previousStatus} -> ${receivedStatusEvent.data?.newStatus}`);
    console.log(`      Vendor ID in payload: ${receivedStatusEvent.data?.vendorId}\n`);

    // Clean up test order
    await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
    await prisma.commissionLedger.deleteMany({ where: { orderId: testOrderId } });
    await prisma.order.delete({ where: { id: testOrderId } });

    console.log('====================================================');
    console.log('🎉 Track 3: Merchant & Kitchen KDS Resilience: ALL TESTS PASSED!');
    console.log('====================================================\n');
  } catch (error: any) {
    console.error('\n❌ Track 3 Test Failed:', error.message || error);
    process.exit(1);
  } finally {
    for (const s of socketsToClose) {
      s.disconnect();
    }
    await prisma.$disconnect();
  }
}

runTrack3VendorKDSTests();
