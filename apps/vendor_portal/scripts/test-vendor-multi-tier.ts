import axios from 'axios';
import { PrismaClient } from '../../../services/backend_api/node_modules/@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('../../.env'); } catch { /* env file is optional in CI */ }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`   ✅ ${message}`);
}

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function runMultiTierVerification() {
  console.log('================================================================');
  console.log(' DeliveryOS Vendor Multi-Tier Management & Brand Switching Tests');
  console.log('================================================================\n');

  try {
    // 1. Authenticate Branch Manager (+8801700000002)
    console.log('🔑 1. Testing Branch Manager Authentication & Outlet Scope Locking...');
    const bmAuthRes = await axios.post(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700000002', // Rahim Uddin (Gulshan Branch Manager)
      otp: '123456',
    });
    const bmToken = bmAuthRes.data.data.accessToken;
    const bmHeaders = { Authorization: `Bearer ${bmToken}` };

    const bmProfileRes = await axios.get(`${API_BASE}/vendor/me`, { headers: bmHeaders });
    assert(bmProfileRes.status === 200, 'Branch manager fetched profile successfully');
    const bmProfile = bmProfileRes.data.data;
    assert(bmProfile.outletScope === 'PARTICULAR_OUTLET', `Branch manager scope verified as PARTICULAR_OUTLET`);

    const bmOutletsRes = await axios.get(`${API_BASE}/vendor/outlets`, { headers: bmHeaders });
    assert(bmOutletsRes.status === 200, 'Branch manager fetched outlets list successfully');
    const bmOutlets = bmOutletsRes.data.data;
    assert(Array.isArray(bmOutlets) && bmOutlets.length === 1, `Branch manager restricted to exactly 1 outlet (received: ${bmOutlets.length})`);
    
    const assignedOutlet = bmOutlets[0];
    const gulshanVendorId = assignedOutlet.id;
    console.log(`   ℹ️ Assigned Outlet: ${assignedOutlet.name} [${gulshanVendorId}]`);

    // 2. Authenticate Brand Owner (+8801700000003)
    console.log('\n👑 2. Testing Brand Owner Authentication & Multi-Outlet Switcher...');
    const boAuthRes = await axios.post(`${API_BASE}/auth/otp/verify`, {
      phone: '+8801700000003', // Karim Chowdhury (Burger Point Brand Owner)
      otp: '123456',
    });
    const boToken = boAuthRes.data.data.accessToken;
    const boHeaders = { Authorization: `Bearer ${boToken}` };

    const boProfileRes = await axios.get(`${API_BASE}/vendor/me`, { headers: boHeaders });
    assert(boProfileRes.status === 200, 'Brand owner fetched profile successfully');
    const boProfile = boProfileRes.data.data;
    assert(boProfile.outletScope === 'ALL_OUTLETS_MASTER', `Brand owner scope verified as ALL_OUTLETS_MASTER`);

    const boOutletsRes = await axios.get(`${API_BASE}/vendor/outlets`, { headers: boHeaders });
    assert(boOutletsRes.status === 200, 'Brand owner fetched outlets list successfully');
    const boOutlets = boOutletsRes.data.data;
    assert(Array.isArray(boOutlets) && boOutlets.length >= 2, `Brand owner can access multiple outlets (found ${boOutlets.length} outlets)`);

    const dhanmondiOutlet = boOutlets.find((o: { id: string }) => o.id !== gulshanVendorId);
    assert(!!dhanmondiOutlet, `Found secondary outlet: ${dhanmondiOutlet?.name}`);
    const dhanmondiVendorId = dhanmondiOutlet.id;

    // 3. Security Boundary: Branch Manager Access Denied to Other Outlets
    console.log('\n🛡️  3. Testing Security Boundary: Branch Manager Foreign Outlet Lock...');
    let foreignAccessDenied = false;
    try {
      await axios.get(`${API_BASE}/vendor/settings?vendorId=${dhanmondiVendorId}`, {
        headers: bmHeaders,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        foreignAccessDenied = true;
      }
    }
    assert(foreignAccessDenied, 'Branch Manager received 403 Forbidden when requesting another outlet settings');

    // 4. Branch Manager Allowed Access to Assigned Outlet
    console.log('\n⚙️  4. Testing Branch Manager Access to Assigned Outlet Settings...');
    const bmSettingsRes = await axios.get(`${API_BASE}/vendor/settings?vendorId=${gulshanVendorId}`, {
      headers: bmHeaders,
    });
    assert(bmSettingsRes.status === 200, 'Branch Manager retrieved own outlet settings successfully');
    assert(bmSettingsRes.data.data.id === gulshanVendorId, 'Outlet settings match assigned vendor ID');

    // 5. Emergency Rush Pause Feature
    console.log('\n🛑 5. Testing Emergency Rush Pause & Store Status Control...');
    try {
      // Pause Store
      const pauseRes = await axios.patch(
        `${API_BASE}/vendor/settings`,
        {
          vendorId: gulshanVendorId,
          isBusy: true,
          busyReason: 'High kitchen rush test',
        },
        { headers: bmHeaders }
      );
      assert(pauseRes.status === 200, 'Emergency Rush Pause triggered successfully');
      assert(pauseRes.data.data.isBusy === true, 'Vendor status correctly shows isBusy = true');

      // Verify Rush Pause status persisted
      const verifyPauseRes = await axios.get(`${API_BASE}/vendor/settings?vendorId=${gulshanVendorId}`, {
        headers: bmHeaders,
      });
      assert(verifyPauseRes.data.data.isBusy === true, 'Rush pause state persisted in database');
    } finally {
      // Restore Store Status
      const resumeRes = await axios.patch(
        `${API_BASE}/vendor/settings`,
        {
          vendorId: gulshanVendorId,
          isBusy: false,
        },
        { headers: bmHeaders }
      );
      assert(resumeRes.status === 200, 'Emergency Rush Pause resumed back to normal');
      assert(resumeRes.data.data.isBusy === false, 'Vendor status correctly restored to isBusy = false');
    }

    // 6. Operating Hours Update
    console.log('\n🕒 6. Testing Weekly Operating Schedule Configuration...');
    const testHours = [
      { dayOfWeek: 0, openTime: '10:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 1, openTime: '10:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 2, openTime: '10:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 3, openTime: '10:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 4, openTime: '10:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 5, openTime: '14:00', closeTime: '23:30', isClosed: false },
      { dayOfWeek: 6, openTime: '10:00', closeTime: '23:00', isClosed: false },
    ];
    const updateHoursRes = await axios.put(
      `${API_BASE}/vendor/operating-hours`,
      {
        vendorId: gulshanVendorId,
        hours: testHours,
      },
      { headers: bmHeaders }
    );
    assert(updateHoursRes.status === 200, 'Operating hours updated successfully');
    assert(updateHoursRes.data.data.length === 7, 'Configured 7 days of weekly operating schedule');

    // 7. Sales Ledger & 15% Platform Commission Reporting
    console.log('\n💰 7. Testing Sales Ledger & Commission Reporting (Consolidated vs Per Outlet)...');
    
    // Per Outlet Sales (Branch Manager)
    const bmSalesRes = await axios.get(`${API_BASE}/vendor/sales?vendorId=${gulshanVendorId}`, {
      headers: bmHeaders,
    });
    assert(bmSalesRes.status === 200, 'Branch Manager fetched outlet sales ledger');
    const bmSales = bmSalesRes.data.data;
    assert(typeof bmSales.summary.grossSales === 'number', 'Branch sales ledger has grossSales summary');
    assert(typeof bmSales.summary.commissionDeducted === 'number', 'Branch sales ledger has commissionDeducted summary');
    assert(typeof bmSales.summary.netVendorPayable === 'number', 'Branch sales ledger has netVendorPayable summary');
    console.log(`   📊 Gulshan Outlet: Gross ৳${bmSales.summary.grossSales} | Commission ৳${bmSales.summary.commissionDeducted} | Net ৳${bmSales.summary.netVendorPayable} across ${bmSales.summary.totalOrders} orders`);

    // Consolidated All Outlets Sales (Brand Owner)
    const boSalesRes = await axios.get(`${API_BASE}/vendor/sales?vendorId=ALL`, {
      headers: boHeaders,
    });
    assert(boSalesRes.status === 200, 'Brand Owner fetched consolidated ALL outlets sales ledger');
    const boSales = boSalesRes.data.data;
    assert(boSales.summary.totalOrders >= bmSales.summary.totalOrders, 'Consolidated report includes all brand outlet orders');
    console.log(`   📊 Brand Consolidated: Gross ৳${boSales.summary.grossSales} | Commission ৳${boSales.summary.commissionDeducted} | Net ৳${boSales.summary.netVendorPayable} across ${boSales.summary.totalOrders} orders`);

    if (boSales.ledgers.length > 0) {
      const sampleItem = boSales.ledgers[0];
      const rate = sampleItem.commissionRate > 0 ? sampleItem.commissionRate / 100 : 0.15;
      const expectedCommission = Math.round(sampleItem.grossAmount * rate * 100) / 100;
      const expectedNet = Math.round((sampleItem.grossAmount - expectedCommission) * 100) / 100;
      assert(
        Math.abs(sampleItem.commissionAmount - expectedCommission) < 0.05,
        `Ledger order #${sampleItem.orderNumber} correctly calculates platform commission (৳${sampleItem.commissionAmount})`
      );
      assert(
        Math.abs(sampleItem.netVendorPayable - expectedNet) < 0.05,
        `Ledger order #${sampleItem.orderNumber} correctly calculates net vendor payable (৳${sampleItem.netVendorPayable})`
      );
    }

    console.log('\n================================================================');
    console.log(' 🎉 All Vendor Multi-Tier & Brand Switching Tests Passed!');
    console.log('================================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

runMultiTierVerification().catch((err) => {
  console.error('Multi-tier verification error:', err.response?.data || err.message);
  process.exit(1);
});
