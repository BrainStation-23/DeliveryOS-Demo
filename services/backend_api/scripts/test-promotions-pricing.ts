import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DeliveryFeeService } from '../src/modules/promotions/pricing/delivery-fee.service';

async function runPromotionsPricingTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Promotions & Pricing Verification Suite');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4097;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Active Promotional Banners
    // -------------------------------------------------------------------------
    console.log('🎨 1. Testing GET /banners/active...');
    const bannerRes = await fetch(`${baseUrl}/banners/active`);
    const bannerJson = await bannerRes.json();
    console.log(`   Response: status=${bannerRes.status}, count=${bannerJson.data?.length}`);

    if (bannerRes.status !== 200 || !Array.isArray(bannerJson.data) || bannerJson.data.length === 0) {
      throw new Error('Failed to retrieve active promotional banners');
    }
    const firstBanner = bannerJson.data[0];
    console.log(`   Top Banner: "${firstBanner.title}", linkType=${firstBanner.linkType}, sortOrder=${firstBanner.sortOrder}`);
    console.log('   ✅ Active promotional banners retrieved successfully with deep links!\n');

    // -------------------------------------------------------------------------
    // Test 2: Flat Coupon Validation (WELCOME50: 50 BDT flat on min spend 250)
    // -------------------------------------------------------------------------
    console.log('🏷️  2. Testing Coupon WELCOME50 (Flat 50 BDT on min 250 spend)...');

    // Case 2A: Below min spend (subtotal: 200) -> Should fail with 400
    const failMinSpendRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'WELCOME50',
        cartSubtotal: 200.0,
      }),
    });
    const failMinSpendJson = await failMinSpendRes.json();
    console.log(`   Case 2A (Subtotal 200 < 250): status=${failMinSpendRes.status}, message="${failMinSpendJson.message}"`);
    if (failMinSpendRes.status !== 400) {
      throw new Error('Expected 400 Bad Request for subtotal below minimum spend');
    }

    // Case 2B: Meets min spend (subtotal: 500) -> Should succeed with 50 flat discount
    const passFlatRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'WELCOME50',
        cartSubtotal: 500.0,
      }),
    });
    const passFlatJson = await passFlatRes.json();
    console.log(`   Case 2B (Subtotal 500): status=${passFlatRes.status}, discount=${passFlatJson.data?.discountAmount}, finalSubtotal=${passFlatJson.data?.finalSubtotal}`);
    if (passFlatRes.status !== 200 || passFlatJson.data?.discountAmount !== 50 || passFlatJson.data?.finalSubtotal !== 450) {
      throw new Error('Flat discount calculation error');
    }
    console.log('   ✅ Flat coupon validation and deduction verified!\n');

    // -------------------------------------------------------------------------
    // Test 3: Percentage Coupon with Maximum Cap (BURGER20: 20% off, max 100)
    // -------------------------------------------------------------------------
    console.log('🏷️  3. Testing Coupon BURGER20 (20% off with max cap 100 BDT)...');

    // Case 3A: Subtotal 400 -> 20% is 80 (under 100 cap)
    const underCapRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'BURGER20',
        cartSubtotal: 400.0,
      }),
    });
    const underCapJson = await underCapRes.json();
    console.log(`   Case 3A (Subtotal 400): discount=${underCapJson.data?.discountAmount} (expected 80), finalSubtotal=${underCapJson.data?.finalSubtotal} (expected 320)`);
    if (underCapJson.data?.discountAmount !== 80 || underCapJson.data?.finalSubtotal !== 320) {
      throw new Error('Percentage discount under cap failed calculation');
    }

    // Case 3B: Subtotal 800 -> 20% is 160 (exceeds 100 cap, should be capped at 100)
    const overCapRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'BURGER20',
        cartSubtotal: 800.0,
      }),
    });
    const overCapJson = await overCapRes.json();
    console.log(`   Case 3B (Subtotal 800): discount=${overCapJson.data?.discountAmount} (expected 100 CAPPED), finalSubtotal=${overCapJson.data?.finalSubtotal} (expected 700)`);
    if (overCapJson.data?.discountAmount !== 100 || overCapJson.data?.finalSubtotal !== 700) {
      throw new Error('Percentage discount cap enforcement failed');
    }
    console.log('   ✅ Percentage coupon calculation and max cap enforcement verified with 100% precision!\n');

    // -------------------------------------------------------------------------
    // Test 4: Dynamic Delivery Fee Service (Flat vs Distance-Tiered)
    // -------------------------------------------------------------------------
    console.log('💵 4. Testing Delivery Fee Calculation Service...');
    const feeService = app.get(DeliveryFeeService);

    // Active DB Setting test (FIXED_FLAT default 50.0 BDT)
    const flatFeeResult = await feeService.calculateFee(3.5);
    console.log(`   Mode FIXED_FLAT (Distance 3.5 km): fee=${flatFeeResult.deliveryFee} BDT, mode=${flatFeeResult.mode}`);
    if (flatFeeResult.deliveryFee !== 50 || flatFeeResult.mode !== 'FIXED_FLAT') {
      throw new Error('Fixed flat delivery fee calculation failed');
    }
    console.log('   ✅ Delivery fee calculation verified against active system settings!\n');

    console.log('====================================================');
    console.log('🎉 Task 2.3: Promotions & Pricing Engine PASSED!');
    console.log('====================================================');
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

runPromotionsPricingTest().catch((err) => {
  console.error('❌ Promotions & Pricing Test Failed:', err);
  process.exit(1);
});
