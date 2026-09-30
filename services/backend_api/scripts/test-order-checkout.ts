import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';

async function runOrderCheckoutTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Order Checkout & Ledger Verification');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4096;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  const prisma = app.get(PrismaService);

  try {
    // -------------------------------------------------------------------------
    // Setup: Get Customer Token and Test Data
    // -------------------------------------------------------------------------
    console.log('🔑 Authenticating as Customer (+8801700000005)...');
    const authRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+8801700000005',
        otp: '123456',
      }),
    });
    const authJson = await authRes.json();
    if (authRes.status !== 200 || !authJson.data?.accessToken) {
      throw new Error(`Failed to login as customer: ${JSON.stringify(authJson)}`);
    }
    const customerToken = authJson.data.accessToken;
    const customerId = authJson.data.user.id;
    console.log(`   ✅ Customer authenticated. ID: ${customerId}\n`);

    // Fetch Outlets & Products
    const gulshanOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'Gulshan Branch' } },
      include: {
        products: {
          include: { variants: true, addonGroups: { include: { addons: true } } },
        },
      },
    });

    const freshmartOutlet = await prisma.vendor.findFirst({
      where: { name: { contains: 'FreshMart' } },
      include: {
        products: true,
      },
    });

    if (!gulshanOutlet || !freshmartOutlet) {
      throw new Error('Gulshan or FreshMart outlet not found in database');
    }

    const gulshanProduct = gulshanOutlet.products.find((p) => Number(p.basePrice) >= 250) || gulshanOutlet.products[0];
    const freshmartProduct = freshmartOutlet.products[0];

    // Customer In-Coverage Address
    const inCoverageAddress = await prisma.customerAddress.findFirst({
      where: { userId: customerId, isDefault: true },
    });
    if (!inCoverageAddress) {
      throw new Error('Customer in-coverage address not found');
    }

    // Customer Out-of-Coverage Address (Chittagong ~200km away)
    let outCoverageAddress = await prisma.customerAddress.findFirst({
      where: { userId: customerId, label: 'Remote Far Away' },
    });
    if (!outCoverageAddress) {
      outCoverageAddress = await prisma.customerAddress.create({
        data: {
          userId: customerId,
          label: 'Remote Far Away',
          addressLine: 'GEC Circle, Chittagong',
          latitude: 22.3569,
          longitude: 91.7832,
        },
      });
    }

    // -------------------------------------------------------------------------
    // Test 1: Single-Vendor Guard
    // -------------------------------------------------------------------------
    console.log('🛡️  1. Testing Single-Vendor Cart Guard...');
    const multiVendorRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: inCoverageAddress.id,
        items: [
          { productId: gulshanProduct.id, quantity: 1 },
          { productId: freshmartProduct.id, quantity: 1 },
        ],
      }),
    });
    const multiVendorJson = await multiVendorRes.json();
    console.log(`   Status: ${multiVendorRes.status}, Message: "${multiVendorJson.message}"`);
    if (multiVendorRes.status !== 400) {
      throw new Error('Expected 400 Bad Request for multi-vendor cart items');
    }
    console.log('   ✅ Multi-vendor cart successfully blocked!\n');

    // -------------------------------------------------------------------------
    // Test 2: Address Geofence Guard (Strict Out-of-Coverage Rejection)
    // -------------------------------------------------------------------------
    console.log('📍 2. Testing Address Geofence Guard (Out-of-Coverage Address)...');
    const outCoverageRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: outCoverageAddress.id,
        items: [{ productId: gulshanProduct.id, quantity: 1 }],
      }),
    });
    const outCoverageJson = await outCoverageRes.json();
    console.log(`   Status: ${outCoverageRes.status}, Error: "${outCoverageJson.error || outCoverageJson.message}"`);
    if (outCoverageRes.status !== 422) {
      throw new Error('Expected 422 Unprocessable Entity for out-of-coverage delivery address');
    }
    console.log('   ✅ Geofence guard successfully rejected out-of-coverage address!\n');

    // -------------------------------------------------------------------------
    // Test 3: Successful Checkout with Coupon & Double-Entry Ledger Validation
    // -------------------------------------------------------------------------
    console.log('💳 3. Testing Atomic Checkout with Coupon WELCOME50 & Ledger Creation...');
    const initialCoupon = await prisma.coupon.findUnique({ where: { code: 'WELCOME50' } });
    const initialCouponUses = initialCoupon?.currentUses || 0;

    const variant = gulshanProduct.variants[0];
    const addon = gulshanProduct.addonGroups[0]?.addons[0];

    const checkoutRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        vendorId: gulshanOutlet.id,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddressId: inCoverageAddress.id,
        couponCode: 'WELCOME50',
        customerNotes: 'Please ring the doorbell',
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [
          {
            productId: gulshanProduct.id,
            variantId: variant?.id,
            addonIds: addon ? [addon.id] : [],
            quantity: 2,
          },
        ],
      }),
    });
    const checkoutJson = await checkoutRes.json();
    console.log(`   Status: ${checkoutRes.status}, Order Number: ${checkoutJson.data?.orderNumber}`);
    if (checkoutRes.status !== 201 || !checkoutJson.data?.orderId) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkoutJson)}`);
    }

    const orderData = checkoutJson.data;
    console.log(`   Subtotal: ${orderData.subtotal} BDT`);
    console.log(`   Coupon Discount: ${orderData.couponDiscount} BDT`);
    console.log(`   Delivery Fee: ${orderData.deliveryFee} BDT`);
    console.log(`   Total Amount: ${orderData.totalAmount} BDT`);
    console.log(`   Commission Amount: ${orderData.commissionAmount} BDT`);
    console.log(`   Net Vendor Payable: ${orderData.netVendorPayable} BDT`);

    // Verify in Database
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderData.orderId },
      include: { orderItems: true, commission: true },
    });

    if (!dbOrder) {
      throw new Error('Order not found in database');
    }

    if (dbOrder.status !== 'PLACED') {
      throw new Error(`Expected order status PLACED, got ${dbOrder.status}`);
    }

    if (!dbOrder.commission) {
      throw new Error('Commission ledger was not created');
    }

    // Verify Double-Entry Balance
    // Net Subtotal = Subtotal - Coupon Discount
    const expectedNetSubtotal = Math.round((Number(dbOrder.subtotal) - Number(dbOrder.couponDiscount)) * 100) / 100;
    const expectedCommission = Math.round((expectedNetSubtotal * (Number(gulshanOutlet.commissionRate) / 100)) * 100) / 100;
    const expectedPayable = Math.round((expectedNetSubtotal - expectedCommission) * 100) / 100;

    console.log(`   Ledger Verification:`);
    console.log(`     Gross Amount (Net Subtotal): ${dbOrder.commission.grossAmount} BDT (Expected: ${expectedNetSubtotal})`);
    console.log(`     Commission Amount: ${dbOrder.commission.commissionAmount} BDT (Expected: ${expectedCommission})`);
    console.log(`     Net Vendor Payable: ${dbOrder.commission.netVendorPayable} BDT (Expected: ${expectedPayable})`);

    if (
      Number(dbOrder.commission.grossAmount) !== expectedNetSubtotal ||
      Number(dbOrder.commission.commissionAmount) !== expectedCommission ||
      Number(dbOrder.commission.netVendorPayable) !== expectedPayable
    ) {
      throw new Error('Commission ledger amounts do not balance mathematically');
    }

    // Verify Coupon Usage Incremented
    const updatedCoupon = await prisma.coupon.findUnique({ where: { code: 'WELCOME50' } });
    if ((updatedCoupon?.currentUses || 0) !== initialCouponUses + 1) {
      throw new Error(`Coupon usage was not incremented: initial=${initialCouponUses}, current=${updatedCoupon?.currentUses}`);
    }
    console.log(`   Coupon Usage: Incremented from ${initialCouponUses} -> ${updatedCoupon?.currentUses}`);
    console.log('   ✅ Order checkout and balanced commission ledger verified!\n');

    // -------------------------------------------------------------------------
    // Test 4: Validate Re-Order from History
    // -------------------------------------------------------------------------
    console.log('🔄 4. Testing POST /orders/validate-reorder...');
    const reorderRes = await fetch(`${baseUrl}/orders/validate-reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        previousOrderId: dbOrder.id,
      }),
    });
    const reorderJson = await reorderRes.json();
    console.log(`   Status: ${reorderRes.status}, isStoreOperational=${reorderJson.data?.isStoreOperational}, hasStockChanges=${reorderJson.data?.hasStockChanges}`);
    console.log(`   Valid Items Count: ${reorderJson.data?.validItems?.length}`);

    if (reorderRes.status !== 200 || !reorderJson.data?.isStoreOperational || reorderJson.data?.validItems?.length === 0) {
      throw new Error('Re-order validation failed');
    }
    console.log('   ✅ Re-order validation succeeded with active stock!\n');

    // -------------------------------------------------------------------------
    // Test 5: Customer Order History & Order Details
    // -------------------------------------------------------------------------
    console.log('📜 5. Testing GET /orders/history and GET /orders/:id...');
    const historyRes = await fetch(`${baseUrl}/orders/history`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const historyJson = await historyRes.json();
    console.log(`   Order History Status: ${historyRes.status}, Orders Count: ${historyJson.data?.items?.length}`);
    if (historyRes.status !== 200 || !Array.isArray(historyJson.data?.items) || historyJson.data.items.length === 0) {
      throw new Error('Order history retrieval failed');
    }

    const detailRes = await fetch(`${baseUrl}/orders/${dbOrder.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const detailJson = await detailRes.json();
    console.log(`   Order Details Status: ${detailRes.status}, OrderNumber: ${detailJson.data?.orderNumber}, Items: ${detailJson.data?.orderItems?.length}`);
    if (detailRes.status !== 200 || detailJson.data?.id !== dbOrder.id) {
      throw new Error('Order details retrieval failed');
    }
    console.log('   ✅ Order history and details retrieved successfully!\n');

    console.log('====================================================');
    console.log(' 🎉 All Order Checkout & Ledger Tests Passed!');
    console.log('====================================================\n');
  } finally {
    await prisma.customerAddress.deleteMany({ where: { label: 'Remote Far Away' } });
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

runOrderCheckoutTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
