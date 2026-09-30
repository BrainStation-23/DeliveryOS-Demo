import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Same resolution order as AppModule's ConfigModule so standalone
// suites run without manually exporting the repo .env.
loadEnv({ path: ['../../.env', '.env'] });

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function requestJson(url: string, method: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  const data = json && json.data !== undefined ? json.data : json;
  return { status: res.status, ok: res.ok, data, raw: json };
}

async function runAddressProfileTests() {
  console.log('====================================================');
  console.log(' DeliveryOS Address Book & Customer Profile Tests');
  console.log('====================================================\n');

  try {
    // 1. Authenticate Customer A
    console.log('🔑 1. Authenticating Customer A...');
    await requestJson(`${API_BASE}/auth/otp/request`, 'POST', { phone: '+8801711223344' });
    const authA = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801711223344',
      otp: '123456',
    });
    const tokenA = authA.data.accessToken;
    const userIdA = authA.data.user.id;
    console.log(`   ✅ Customer A authenticated (ID: ${userIdA})`);

    // Clean up existing addresses for clean test state
    await prisma.customerAddress.deleteMany({ where: { userId: userIdA } });

    // 2. Create Address 1 (Home)
    console.log('\n🏠 2. Creating Address 1 ("Home", isDefault: true)...');
    const addr1Res = await requestJson(
      `${API_BASE}/customers/addresses`,
      'POST',
      {
        label: 'Home',
        addressLine: 'House 12, Road 5, Dhanmondi, Dhaka',
        buildingFloor: 'Apartment 3A, 3rd Floor',
        deliveryNote: 'Call upon arrival',
        latitude: 23.7461,
        longitude: 90.3742,
        isDefault: true,
      },
      tokenA,
    );

    console.log(`   Address 1 created: ID=${addr1Res.data.id}, label="${addr1Res.data.label}", isDefault=${addr1Res.data.isDefault}`);
    if (addr1Res.status !== 201 && addr1Res.status !== 200) {
      throw new Error(`Failed to create Address 1 (status: ${addr1Res.status})`);
    }
    const addr1Id = addr1Res.data.id;

    // 3. Create Address 2 (Work)
    console.log('\n🏢 3. Creating Address 2 ("Work", isDefault: false)...');
    const addr2Res = await requestJson(
      `${API_BASE}/customers/addresses`,
      'POST',
      {
        label: 'Work',
        addressLine: 'Level 8, Tower 71, Mohakhali C/A, Dhaka',
        buildingFloor: 'Floor 8, Suite 802',
        deliveryNote: 'Leave at reception',
        latitude: 23.7772,
        longitude: 90.4055,
        isDefault: false,
      },
      tokenA,
    );

    console.log(`   Address 2 created: ID=${addr2Res.data.id}, label="${addr2Res.data.label}", isDefault=${addr2Res.data.isDefault}`);
    const addr2Id = addr2Res.data.id;

    // 4. List Addresses
    console.log('\n📋 4. Listing Addresses for Customer A...');
    const listRes = await requestJson(`${API_BASE}/customers/addresses`, 'GET', null, tokenA);
    console.log(`   Retrieved ${listRes.data.length} addresses.`);
    if (listRes.data.length !== 2) {
      throw new Error(`Expected 2 addresses, got ${listRes.data.length}`);
    }
    const defaultAddr = listRes.data.find((a: any) => a.isDefault);
    console.log(`   Current default address: ${defaultAddr.label} (ID: ${defaultAddr.id})`);
    if (defaultAddr.id !== addr1Id) {
      throw new Error('Expected Address 1 (Home) to be default');
    }
    console.log('   ✅ Listing and default sorting verified!');

    // 5. Set Address 2 as Default (Atomicity Check)
    console.log('\n⚡ 5. Setting Address 2 ("Work") as Default...');
    const setDefaultRes = await requestJson(
      `${API_BASE}/customers/addresses/${addr2Id}/default`,
      'PATCH',
      null,
      tokenA,
    );
    console.log(`   Set default status: ${setDefaultRes.status}`);

    const refreshedList = await requestJson(`${API_BASE}/customers/addresses`, 'GET', null, tokenA);
    const newDefault = refreshedList.data.find((a: any) => a.isDefault);
    const previousDefault = refreshedList.data.find((a: any) => a.id === addr1Id);

    console.log(`   New Default: ${newDefault.label} (ID: ${newDefault.id})`);
    console.log(`   Previous Default isDefault status: ${previousDefault.isDefault}`);

    if (newDefault.id !== addr2Id || previousDefault.isDefault) {
      throw new Error('Default address promotion was not atomic!');
    }
    console.log('   ✅ Atomic default promotion verified!');

    // 6. Update Address Details
    console.log('\n✏️  6. Updating Address 1 (Home) Delivery Notes...');
    const updateRes = await requestJson(
      `${API_BASE}/customers/addresses/${addr1Id}`,
      'PUT',
      {
        deliveryNote: 'Gate code #9988 - Leave on doorstep',
      },
      tokenA,
    );
    console.log(`   Updated Delivery Note: "${updateRes.data.deliveryNote}"`);
    if (updateRes.data.deliveryNote !== 'Gate code #9988 - Leave on doorstep') {
      throw new Error('Address update failed');
    }
    console.log('   ✅ Address update verified!');

    // 7. Profile Retrieval & Update
    console.log('\n👤 7. Testing Customer Profile Retrieval & Updates...');
    const profileRes = await requestJson(`${API_BASE}/customers/profile`, 'GET', null, tokenA);
    console.log(`   Profile Retrieved: Name="${profileRes.data.fullName}", Total Addresses=${profileRes.data.totalAddresses}`);

    const updateProfileRes = await requestJson(
      `${API_BASE}/customers/profile`,
      'PATCH',
      {
        fullName: 'Imam Hossain (QA Test)',
        email: 'imam.test@deliveryos.local',
      },
      tokenA,
    );
    console.log(`   Profile Updated: Name="${updateProfileRes.data.fullName}", Email="${updateProfileRes.data.email}"`);

    if (updateProfileRes.data.fullName !== 'Imam Hossain (QA Test)' || updateProfileRes.data.email !== 'imam.test@deliveryos.local') {
      throw new Error('Profile update failed');
    }
    console.log('   ✅ Customer profile update verified!');

    // 8. Security Guard: Address Ownership Isolation
    console.log('\n🛡️  8. Testing Customer Isolation (Customer B accessing Customer A address)...');
    await requestJson(`${API_BASE}/auth/otp/request`, 'POST', { phone: '+8801799887766' });
    const authB = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801799887766',
      otp: '123456',
    });
    const tokenB = authB.data.accessToken;

    const crossUpdateRes = await requestJson(
      `${API_BASE}/customers/addresses/${addr1Id}`,
      'PUT',
      { label: 'Hacked Label' },
      tokenB,
    );
    console.log(`   Cross-User Update Attempt: status=${crossUpdateRes.status}`);
    if (crossUpdateRes.status !== 403 && crossUpdateRes.status !== 404) {
      throw new Error(`Expected 403 or 404 on cross-user modification, got ${crossUpdateRes.status}`);
    }

    const crossDeleteRes = await requestJson(
      `${API_BASE}/customers/addresses/${addr1Id}`,
      'DELETE',
      null,
      tokenB,
    );
    console.log(`   Cross-User Delete Attempt: status=${crossDeleteRes.status}`);
    if (crossDeleteRes.status !== 403 && crossDeleteRes.status !== 404) {
      throw new Error(`Expected 403 or 404 on cross-user deletion, got ${crossDeleteRes.status}`);
    }
    console.log('   ✅ Strict address ownership isolation verified!');

    // 9. Delete Address
    console.log('\n🗑️  9. Deleting Address 2 (Work)...');
    const deleteRes = await requestJson(
      `${API_BASE}/customers/addresses/${addr2Id}`,
      'DELETE',
      null,
      tokenA,
    );
    console.log(`   Delete response: status=${deleteRes.status}, success=${deleteRes.data.success}`);

    const finalList = await requestJson(`${API_BASE}/customers/addresses`, 'GET', null, tokenA);
    console.log(`   Remaining addresses: ${finalList.data.length}`);
    if (finalList.data.length !== 1) {
      throw new Error('Address deletion failed');
    }
    console.log('   ✅ Address deleted cleanly!');

    console.log('\n====================================================');
    console.log(' 🎉 All Customer Address & Profile Tests Passed!');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ Address/Profile Test Failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAddressProfileTests();
