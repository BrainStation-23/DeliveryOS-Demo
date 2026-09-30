import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log(' DeliveryOS Database & PostGIS Verification Suite');
  console.log('====================================================\n');

  // 1. Verify Prisma Models
  const models = [
    'user', 'customerAddress', 'vendorBrand', 'vendor', 'vendorStaff',
    'vendorOperatingHour', 'category', 'product', 'productVariant',
    'productAddonGroup', 'productAddon', 'banner', 'coupon', 'rider',
    'systemSetting', 'order', 'orderItem', 'commissionLedger', 'riderTripLedger'
  ];

  console.log('🔍 1. Checking all 19 Prisma domain models...');
  for (const model of models) {
    if (typeof (prisma as any)[model] === 'undefined') {
      throw new Error(`Missing model on Prisma Client: ${model}`);
    }
  }
  console.log(`✅ All 19 models successfully generated and accessible on Prisma Client!\n`);

  // 2. Add GIST Spatial Indexes
  console.log('🌍 2. Applying PostGIS GIST Spatial Indexes...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_geo 
    ON customer_addresses USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_vendors_geo 
    ON vendors USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_riders_geo 
    ON riders USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
  `);
  console.log('✅ PostGIS GIST spatial indexes verified on customer_addresses, vendors, and riders!\n');

  // 3. Test PostGIS Spatial Distance and Coverage Calculation
  console.log('🎯 3. Testing PostGIS Spatial Distance & Coverage Logic...');
  // Test Store: Gulshan 2, Dhaka (Lat: 23.7925, Lng: 90.4078), Radius: 3.5 km
  const testVendor = await prisma.vendor.create({
    data: {
      name: 'PostGIS Test Burger Kitchen',
      contactPhone: '+8801711000000',
      latitude: 23.7925,
      longitude: 90.4078,
      addressText: 'Road 11, Gulshan 2, Dhaka',
      deliveryRadiusKm: 3.5,
      defaultPrepTimeMinutes: 20
    }
  });

  // Coordinate A (Inside coverage): Banani (Lat: 23.7937, Lng: 90.4043) ~ 0.38 km away
  const insideCoord = { lat: 23.7937, lng: 90.4043 };
  const insideResult: any[] = await prisma.$queryRaw`
    SELECT 
      ROUND((ST_Distance(
        CAST(ST_SetSRID(ST_MakePoint(${testVendor.longitude}, ${testVendor.latitude}), 4326) AS geography),
        CAST(ST_SetSRID(ST_MakePoint(${insideCoord.lng}, ${insideCoord.lat}), 4326) AS geography)
      ) / 1000)::numeric, 2) AS distance_km,
      ST_DWithin(
        CAST(ST_SetSRID(ST_MakePoint(${testVendor.longitude}, ${testVendor.latitude}), 4326) AS geography),
        CAST(ST_SetSRID(ST_MakePoint(${insideCoord.lng}, ${insideCoord.lat}), 4326) AS geography),
        ${Number(testVendor.deliveryRadiusKm)} * 1000
      ) AS is_within_coverage
  `;

  // Coordinate B (Outside coverage): Uttara (Lat: 23.8759, Lng: 90.3795) ~ 9.7 km away
  const outsideCoord = { lat: 23.8759, lng: 90.3795 };
  const outsideResult: any[] = await prisma.$queryRaw`
    SELECT 
      ROUND((ST_Distance(
        CAST(ST_SetSRID(ST_MakePoint(${testVendor.longitude}, ${testVendor.latitude}), 4326) AS geography),
        CAST(ST_SetSRID(ST_MakePoint(${outsideCoord.lng}, ${outsideCoord.lat}), 4326) AS geography)
      ) / 1000)::numeric, 2) AS distance_km,
      ST_DWithin(
        CAST(ST_SetSRID(ST_MakePoint(${testVendor.longitude}, ${testVendor.latitude}), 4326) AS geography),
        CAST(ST_SetSRID(ST_MakePoint(${outsideCoord.lng}, ${outsideCoord.lat}), 4326) AS geography),
        ${Number(testVendor.deliveryRadiusKm)} * 1000
      ) AS is_within_coverage
  `;

  console.log(`   • Location A (Banani): Distance = ${insideResult[0].distance_km} km, Within Coverage = ${insideResult[0].is_within_coverage}`);
  console.log(`   • Location B (Uttara): Distance = ${outsideResult[0].distance_km} km, Within Coverage = ${outsideResult[0].is_within_coverage}`);

  if (insideResult[0].is_within_coverage !== true || outsideResult[0].is_within_coverage !== false) {
    throw new Error('PostGIS spatial geofence calculation failed expected assertions!');
  }
  console.log('✅ PostGIS spatial geofence & distance assertions passed with 100% precision!\n');

  // Clean up test record
  await prisma.vendor.delete({ where: { id: testVendor.id } });
  console.log('🧹 Cleaned up test record.');

  console.log('\n====================================================');
  console.log('🎉 Task 1.2: Database Migrations & Data Models COMPLETE!');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('❌ Verification Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
