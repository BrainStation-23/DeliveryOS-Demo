import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

async function runVendorDiscoveryTest() {
  console.log('====================================================');
  console.log(' DeliveryOS Vendor Discovery & Geofence Verification');
  console.log('====================================================\n');

  const prisma = new PrismaClient();
  const gulshanStore = await prisma.vendor.findFirst({
    where: { name: 'Burger Point — Gulshan Branch' },
  });

  if (!gulshanStore) {
    throw new Error('Gulshan store not found in database. Please run seed script first.');
  }

  // The discovery test asserts specific fixtures appear in nearby results; make
  // sure prior test runs that toggled vendor state don't break the invariant.
  const fixtures = ['Burger Point — Gulshan Branch', 'FreshMart Daily — Gulshan Hub'];
  const originalStates = new Map<string, boolean>();
  for (const name of fixtures) {
    const vendor = await prisma.vendor.findFirst({ where: { name } });
    if (vendor) {
      originalStates.set(vendor.id, vendor.isActive);
      if (!vendor.isActive) {
        await prisma.vendor.update({ where: { id: vendor.id }, data: { isActive: true } });
      }
    }
  }

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const testPort = 4098;
  await app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  // Coverage validation is an authenticated endpoint: mint a short-lived
  // access token for an active seeded user (mirrors auth.service claims).
  const activeUser = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  if (!activeUser) {
    throw new Error('No active user found in database. Please run seed script first.');
  }
  const authToken = jwt.sign(
    { sub: activeUser.id, phone: activeUser.phone, role: activeUser.role, type: 'access' },
    String(process.env.JWT_SECRET),
    { expiresIn: '10m' },
  );

  try {
    // -------------------------------------------------------------------------
    // Test 1: Nearby Outlets Discovery via PostGIS ST_DWithin
    // -------------------------------------------------------------------------
    console.log('📍 1. Testing GET /vendors/nearby from Banani coordinates (lat: 23.7937, lng: 90.4043)...');
    const nearbyRes = await fetch(`${baseUrl}/vendors/nearby?lat=23.7937&lng=90.4043`);
    const nearbyJson = await nearbyRes.json();
    console.log(`   Response: status=${nearbyRes.status}, count=${nearbyJson.data?.length}`);

    const storeNames = nearbyJson.data?.map((s: any) => s.name) || [];
    console.log(`   Found Outlets: ${storeNames.join(', ')}`);

    const hasGulshan = storeNames.includes('Burger Point — Gulshan Branch');
    const hasFreshMart = storeNames.includes('FreshMart Daily — Gulshan Hub');
    const hasDhanmondi = storeNames.includes('Burger Point — Dhanmondi Branch');

    if (!hasGulshan || !hasFreshMart) {
      throw new Error('Nearby stores in Gulshan/Banani zone were not returned');
    }
    if (hasDhanmondi) {
      throw new Error('Dhanmondi branch is ~7km away and should NOT be within 4.5km coverage of Banani!');
    }
    console.log('   ✅ PostGIS nearby filtering correctly included Gulshan stores and excluded Dhanmondi!\n');

    // -------------------------------------------------------------------------
    // Test 2: Instant Search (Outlets & Dishes)
    // -------------------------------------------------------------------------
    console.log('🔍 2. Testing GET /vendors/search?q=Burger...');
    const searchRes = await fetch(`${baseUrl}/vendors/search?q=Burger&lat=23.7937&lng=90.4043`);
    const searchJson = await searchRes.json();
    console.log(`   Outlets matched: ${searchJson.data?.outlets?.length}, Items matched: ${searchJson.data?.items?.length}`);

    const itemNames = searchJson.data?.items?.map((i: any) => i.name) || [];
    console.log(`   Matched Dishes: ${itemNames.join(', ')}`);

    if (!itemNames.includes('Classic Smoky Beef Burger')) {
      throw new Error('Classic Smoky Beef Burger was not found in search results');
    }
    console.log('   ✅ Instant search correctly found matching outlets and dish items!\n');

    // -------------------------------------------------------------------------
    // Test 3: Get Outlet Catalog
    // -------------------------------------------------------------------------
    console.log(`📋 3. Testing GET /vendors/${gulshanStore.id}/catalog...`);
    const catalogRes = await fetch(`${baseUrl}/vendors/${gulshanStore.id}/catalog`);
    const catalogJson = await catalogRes.json();
    const categories = catalogJson.data?.categories || [];
    console.log(`   Categories count: ${categories.length}, Store: "${catalogJson.data?.name}"`);

    if (categories.length === 0 || !categories[0].products || categories[0].products.length === 0) {
      throw new Error('Catalog did not return categories with products');
    }
    const sampleProduct = categories[0].products[0];
    console.log(`   Sample Product: "${sampleProduct.name}", Variants: ${sampleProduct.variants?.length}`);
    console.log('   ✅ Catalog endpoint successfully returned full nested menu hierarchy!\n');

    // -------------------------------------------------------------------------
    // Test 4: Cart Address Geofence Guard (Inside Coverage - Banani)
    // -------------------------------------------------------------------------
    console.log('🛡️  4. Testing POST /cart/validate-address-coverage (Inside Coverage - Banani)...');

    // Security invariant: the coverage oracle is authenticated — anonymous
    // probes must be rejected with 401 before any coordinate math runs.
    const anonRes = await fetch(`${baseUrl}/cart/validate-address-coverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: gulshanStore.id, latitude: 23.7937, longitude: 90.4043 }),
    });
    if (anonRes.status !== 401) {
      throw new Error(`Anonymous coverage probe should be 401, received ${anonRes.status}`);
    }
    console.log('   ✅ Anonymous probe correctly rejected with 401 (authenticated oracle)!');

    const validCoordRes = await fetch(`${baseUrl}/cart/validate-address-coverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        vendorId: gulshanStore.id,
        latitude: 23.7937,
        longitude: 90.4043,
      }),
    });
    const validCoordJson = await validCoordRes.json();
    console.log(`   Response: status=${validCoordRes.status}, isWithinCoverage=${validCoordJson.data?.isWithinCoverage}, distanceKm=${validCoordJson.data?.distanceKm} km`);
    if (validCoordRes.status !== 200 || validCoordJson.data?.isWithinCoverage !== true) {
      throw new Error('Cart address inside coverage was incorrectly rejected');
    }
    console.log('   ✅ Address within coverage accepted with 200 OK!\n');

    // -------------------------------------------------------------------------
    // Test 5: Cart Address Geofence Guard (Outside Coverage - Uttara ~9.7km away)
    // -------------------------------------------------------------------------
    console.log('🚫 5. Testing POST /cart/validate-address-coverage (Outside Coverage - Uttara)...');
    const invalidCoordRes = await fetch(`${baseUrl}/cart/validate-address-coverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        vendorId: gulshanStore.id,
        latitude: 23.8759,
        longitude: 90.3795,
      }),
    });
    const invalidCoordJson = await invalidCoordRes.json();
    console.log(`   Response: status=${invalidCoordRes.status}, error=${invalidCoordJson.error}, message="${invalidCoordJson.message}"`);
    if (invalidCoordRes.status !== 422 || invalidCoordJson.error !== 'ADDRESS_OUT_OF_COVERAGE') {
      throw new Error(`Expected HTTP 422 ADDRESS_OUT_OF_COVERAGE, but received ${invalidCoordRes.status}`);
    }
    console.log('   ✅ Cart Address Geofence Guard strictly blocked out-of-coverage address with HTTP 422!\n');

    console.log('====================================================');
    console.log('🎉 Task 2.2: Geofencing & Discovery Verification PASSED!');
    console.log('====================================================');
  } finally {
    for (const [vendorId, wasActive] of originalStates) {
      if (!wasActive) {
        await prisma.vendor.update({ where: { id: vendorId }, data: { isActive: false } });
      }
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
    await prisma.$disconnect();
  }
}

runVendorDiscoveryTest().catch((err) => {
  console.error('❌ Discovery Test Failed:', err);
  process.exit(1);
});
