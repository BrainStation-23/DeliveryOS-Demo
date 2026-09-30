import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

async function runAuthRbacTest() {
  console.log('====================================================');
  console.log(' DeliveryOS AuthModule & RBAC Verification Suite');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4099;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Request Phone OTP
    // -------------------------------------------------------------------------
    console.log('📱 1. Testing POST /auth/otp/request...');
    const reqOtpRes = await fetch(`${baseUrl}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+8801700000005',
        role: 'CUSTOMER'
      }),
    });
    const reqOtpJson = await reqOtpRes.json();
    console.log(`   Response: status=${reqOtpRes.status}, success=${reqOtpJson.success}, message="${reqOtpJson.message}"`);
    if (reqOtpRes.status !== 200 || !reqOtpJson.success) {
      throw new Error('OTP Request failed');
    }
    console.log('   ✅ OTP request succeeded!\n');

    // -------------------------------------------------------------------------
    // Test 2: Verify Phone OTP & Receive Customer JWT Tokens
    // -------------------------------------------------------------------------
    console.log('🔑 2. Testing POST /auth/otp/verify with Customer OTP...');
    const verifyRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+8801700000005',
        otp: '123456'
      }),
    });
    const verifyJson = await verifyRes.json();
    console.log(`   Response: status=${verifyRes.status}, role=${verifyJson.data?.user?.role}, token_present=${Boolean(verifyJson.data?.accessToken)}`);
    if (verifyRes.status !== 200 || !verifyJson.data?.accessToken || verifyJson.data?.user?.role !== 'CUSTOMER') {
      throw new Error('OTP Verification failed for Customer');
    }
    const customerToken = verifyJson.data.accessToken;
    console.log('   ✅ Customer JWT token successfully received!\n');

    // -------------------------------------------------------------------------
    // Test 3: Authenticated Profile Call with Bearer Token
    // -------------------------------------------------------------------------
    console.log('👤 3. Testing GET /auth/me with Customer Bearer Token...');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const meJson = await meRes.json();
    console.log(`   Response: status=${meRes.status}, userId=${meJson.data?.id}, fullName="${meJson.data?.fullName}"`);
    if (meRes.status !== 200 || !meJson.data?.id) {
      throw new Error('Get profile failed');
    }
    console.log('   ✅ Customer profile retrieved successfully!\n');

    // -------------------------------------------------------------------------
    // Test 4: RBAC Guard Enforcement (Customer tries accessing Super Admin endpoint)
    // -------------------------------------------------------------------------
    console.log('🛡️  4. Testing RBAC Guard: Customer accessing /admin/overview...');
    const forbiddenRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const forbiddenJson = await forbiddenRes.json();
    console.log(`   Response: status=${forbiddenRes.status}, error=${forbiddenJson.error}, message="${forbiddenJson.message}"`);
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden, but received ${forbiddenRes.status}`);
    }
    console.log('   ✅ RBAC Guard correctly blocked unauthorized customer with 403 Forbidden!\n');

    // -------------------------------------------------------------------------
    // Test 5: Super Admin Login & Authorized Access
    // -------------------------------------------------------------------------
    console.log('👑 5. Testing Super Admin Login & Authorized Admin Access...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+8801700000001',
        otp: '123456'
      }),
    });
    const adminLoginJson = await adminLoginRes.json();
    const adminToken = adminLoginJson.data.accessToken;

    const adminCheckRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCheckJson = await adminCheckRes.json();
    console.log(`   Response: status=${adminCheckRes.status}, message="${adminCheckJson.message}"`);
    if (adminCheckRes.status !== 200) {
      throw new Error('Super Admin access test failed');
    }
    console.log('   ✅ Super Admin successfully accessed protected endpoint /admin/overview with 200 OK!\n');

    console.log('====================================================');
    console.log('🎉 Task 2.1: AuthModule & RBAC Verification PASSED!');
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

runAuthRbacTest().catch((err) => {
  console.error('❌ Auth RBAC Test Failed:', err);
  process.exit(1);
});
