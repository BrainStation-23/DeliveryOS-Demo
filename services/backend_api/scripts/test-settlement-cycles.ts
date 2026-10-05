import { config as loadEnv } from 'dotenv';
import { PrismaClient, OrderStatus, SettlementStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

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

async function runSettlementAndGovernanceTests() {
  console.log('====================================================');
  console.log(' DeliveryOS Governance & Settlement Engine Tests');
  console.log('====================================================\n');

  try {
    // 1. Authenticate Super Admin
    console.log('🔑 1. Authenticating Super Admin...');
    await requestJson(`${API_BASE}/auth/otp/request`, 'POST', { phone: '+8801700000001' });
    const adminAuth = await requestJson(`${API_BASE}/auth/otp/verify`, 'POST', {
      phone: '+8801700000001',
      otp: '123456',
    });
    const adminToken = adminAuth.data?.accessToken || adminAuth.data?.data?.accessToken;
    console.log(`   ✅ Super Admin authenticated successfully!`);

    // 2. Vendor Governance: Edit Outlet & Status Toggle
    console.log('\n🏪 2. Testing Vendor Governance (PATCH /admin/vendors/:id)...');
    const vendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!vendor) throw new Error('No active vendor found in database.');

    const editRes = await requestJson(
      `${API_BASE}/admin/vendors/${vendor.id}`,
      'PATCH',
      {
        commissionRate: 16.5,
        defaultPrepTimeMinutes: 25,
        contactPhone: '+8801799001122',
      },
      adminToken,
    );
    const vendorData = editRes.data?.data || editRes.data;
    console.log(`   Edit Vendor: status=${editRes.status}, commissionRate=${vendorData?.commissionRate}`);
    if (Number(vendorData?.commissionRate) !== 16.5 || vendorData?.defaultPrepTimeMinutes !== 25) {
      throw new Error('Vendor edit failed');
    }
    console.log('   ✅ Vendor parameters updated successfully!');

    // Toggle Status
    console.log('\n   Testing Vendor Status Toggle (Suspend / Re-activate)...');
    const suspendRes = await requestJson(
      `${API_BASE}/admin/vendors/${vendor.id}/status`,
      'PATCH',
      { isActive: false },
      adminToken,
    );
    const suspendData = suspendRes.data?.data || suspendRes.data;
    console.log(`   Suspended: isActive=${suspendData?.isActive}`);
    if (suspendData?.isActive !== false) throw new Error('Failed to suspend vendor');

    const activateRes = await requestJson(
      `${API_BASE}/admin/vendors/${vendor.id}/status`,
      'PATCH',
      { isActive: true },
      adminToken,
    );
    const activateData = activateRes.data?.data || activateRes.data;
    console.log(`   Re-activated: isActive=${activateData?.isActive}`);
    if (activateData?.isActive !== true) throw new Error('Failed to reactivate vendor');
    console.log('   ✅ Vendor status toggle verified!');

    // 3. Rider Fleet Governance: Approval & Cash Limit
    console.log('\n🛵 3. Testing Rider Fleet Governance (Approval & Cash Limits)...');
    const riderListRes = await requestJson(`${API_BASE}/admin/riders`, 'GET', null, adminToken);
    const ridersList = riderListRes.data?.items ?? riderListRes.data;
    console.log(`   Retrieved ${ridersList.length} couriers in fleet.`);
    if (ridersList.length === 0) throw new Error('No riders found');
    const testRider = ridersList[0];

    // Toggle Approval
    const unapproveRes = await requestJson(
      `${API_BASE}/admin/riders/${testRider.id}/approval`,
      'PATCH',
      { isApproved: false },
      adminToken,
    );
    const unapproved = unapproveRes.data?.data || unapproveRes.data;
    console.log(`   Suspended courier: isApproved=${unapproved?.isApproved}, isOnline=${unapproved?.isOnline}`);
    if (unapproved?.isApproved !== false || unapproved?.isOnline !== false) {
      throw new Error('Courier suspension failed or did not kick rider offline');
    }

    const reapproveRes = await requestJson(
      `${API_BASE}/admin/riders/${testRider.id}/approval`,
      'PATCH',
      { isApproved: true },
      adminToken,
    );
    const reapproved = reapproveRes.data?.data || reapproveRes.data;
    console.log(`   Approved courier: isApproved=${reapproved?.isApproved}`);
    if (reapproved?.isApproved !== true) throw new Error('Courier re-approval failed');

    // Update Cash Limit
    const cashLimitRes = await requestJson(
      `${API_BASE}/admin/riders/${testRider.id}/cash-limit`,
      'PATCH',
      { maxCashLimit: 8000 },
      adminToken,
    );
    const cashLimitData = cashLimitRes.data?.data || cashLimitRes.data;
    console.log(`   Updated Cash Limit: ${cashLimitData?.maxCashLimit} BDT`);
    if (Number(cashLimitData?.maxCashLimit) !== 8000) throw new Error('Cash limit update failed');
    console.log('   ✅ Rider approval workflow and cash limits verified!');

    // 4. Financial Settlement Cycle Engine
    console.log('\n💰 4. Testing Financial Settlement Cycle Engine...');

    // Seed a completed order with PENDING commission and trip ledgers to guarantee settlement batch creation
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (!customer) throw new Error('No customer found');

    const testOrder = await prisma.order.create({
      data: {
        orderNumber: `ORD-SETTLE-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        vendorId: vendor.id,
        riderId: testRider.id,
        status: OrderStatus.DELIVERED,
        subtotal: 500.0,
        deliveryFee: 50.0,
        totalAmount: 550.0,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.PAID,
        customerPhoneSnapshot: customer.phone,
        deliveryAddressSnapshot: { addressLine: 'Gulshan 2, Dhaka' },
        deliveredAt: new Date(),
      },
    });

    const commLedger = await prisma.commissionLedger.create({
      data: {
        orderId: testOrder.id,
        vendorId: vendor.id,
        grossAmount: 500.0,
        commissionRate: 15.0,
        commissionAmount: 75.0,
        netVendorPayable: 425.0,
        settlementStatus: SettlementStatus.PENDING,
      },
    });

    const tripLedger = await prisma.riderTripLedger.create({
      data: {
        orderId: testOrder.id,
        riderId: testRider.id,
        deliveryEarnings: 40.0,
        codCollected: 550.0,
        status: SettlementStatus.PENDING,
      },
    });

    console.log(`   Seeded DELIVERED Order ${testOrder.orderNumber} with PENDING Commission and Trip Ledgers.`);

    // Execute Settlement Cycle
    console.log('   Executing POST /admin/finance/settle-cycle...');
    const settleRes = await requestJson(
      `${API_BASE}/admin/finance/settle-cycle`,
      'POST',
      {},
      adminToken,
    );
    const settleData = settleRes.data?.data || settleRes.data;

    console.log(`   Settlement Cycle Result: ${settleData?.message}`);
    console.log(`   Settled Orders Count: ${settleData?.settledOrdersCount}`);

    if (settleRes.status !== 200 && settleRes.status !== 201) {
      throw new Error(`Settlement execution failed with status ${settleRes.status}`);
    }

    if (!settleData?.batch) {
      throw new Error('Expected SettlementBatch to be returned');
    }

    const batch = settleData.batch;
    console.log(`   Batch Created: ${batch.batchNumber} (Total Orders: ${batch.totalOrders}, Vendor Payout: ${batch.totalVendorPayout} BDT, Rider Payout: ${batch.totalRiderPayout} BDT)`);

    // Verify Ledgers transitioned to SETTLED
    const updatedComm = await prisma.commissionLedger.findUnique({ where: { id: commLedger.id } });
    const updatedTrip = await prisma.riderTripLedger.findUnique({ where: { id: tripLedger.id } });

    console.log(`   Commission Ledger Status: ${updatedComm?.settlementStatus}, Batch ID: ${updatedComm?.settlementBatchId}`);
    console.log(`   Trip Ledger Status: ${updatedTrip?.status}, Batch ID: ${updatedTrip?.settlementBatchId}`);

    if (updatedComm?.settlementStatus !== SettlementStatus.SETTLED || updatedComm?.settlementBatchId !== batch.id) {
      throw new Error('Commission ledger was not transitioned to SETTLED with batch ID');
    }
    if (updatedTrip?.status !== SettlementStatus.SETTLED || updatedTrip?.settlementBatchId !== batch.id) {
      throw new Error('Trip ledger was not transitioned to SETTLED with batch ID');
    }
    console.log('   ✅ Atomic ledger transition to SETTLED verified!');

    // 5. Query Settlement Batches
    console.log('\n📜 5. Listing Historical Settlement Batches...');
    const batchesRes = await requestJson(`${API_BASE}/admin/finance/settlement-batches`, 'GET', null, adminToken);
    const batchesList = batchesRes.data?.data || batchesRes.data;
    console.log(`   Retrieved ${batchesList.length} settlement batches.`);
    const foundBatch = batchesList.find((b: any) => b.id === batch.id);
    if (!foundBatch) throw new Error('Newly created settlement batch not found in list');
    console.log('   ✅ Settlement batches listing verified!');

    console.log('\n====================================================');
    console.log(' 🎉 All Governance & Settlement Tests Passed!');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ Settlement/Governance Test Failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSettlementAndGovernanceTests();
