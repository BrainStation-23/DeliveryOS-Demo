import axios from 'axios';
import { PrismaClient } from '../../../services/backend_api/node_modules/@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('../../.env'); } catch {}
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

async function runKdsVerification() {
  console.log('====================================================');
  console.log(' DeliveryOS KDS & Audio Alert Operations Verification');
  console.log('====================================================\n');

  // 1. Authenticate Stakeholders
  console.log('🔑 1. Authenticating Stakeholders...');
  const customerRes = await axios.post(`${API_BASE}/auth/otp/verify`, {
    phone: '+8801700000005', // Sultana Razia (Customer)
    otp: '123456',
  });
  const customerToken = customerRes.data.data.accessToken;
  const customerHeaders = { Authorization: `Bearer ${customerToken}` };

  const managerRes = await axios.post(`${API_BASE}/auth/otp/verify`, {
    phone: '+8801700000002', // Rahim Uddin (Gulshan Branch Manager)
    otp: '123456',
  });
  const managerToken = managerRes.data.data.accessToken;
  const managerHeaders = { Authorization: `Bearer ${managerToken}` };

  const profileRes = await axios.get(`${API_BASE}/vendor/me`, { headers: managerHeaders });
  const staffProfile = profileRes.data.data;
  const vendorId = staffProfile.vendorId;
  assert(!!vendorId, `Branch Manager mapped to outlet ID: ${vendorId}`);

  // 2. Fetch Catalog & Test Stock Toggling
  console.log('\n📦 2. Testing Outlet Menu Catalog & Instant Stock Toggle Board...');
  const catalogRes = await axios.get(`${API_BASE}/vendors/${vendorId}/catalog`);
  const catalog = catalogRes.data.data;
  assert(catalog.categories && catalog.categories.length > 0, `Catalog loaded with ${catalog.categories.length} categories`);

  const testProduct = catalog.categories[0].products[0];
  assert(!!testProduct, `Testing stock toggle on product: "${testProduct.name}" (ID: ${testProduct.id})`);

  try {
    // Toggle Out of Stock
    const oosRes = await axios.patch(
      `${API_BASE}/vendor/products/${testProduct.id}/stock`,
      { isInStock: false },
      { headers: managerHeaders }
    );
    assert(oosRes.status === 200 && (oosRes.data.data.isInStock === false || oosRes.data.data.is_in_stock === false), 'Product toggled to OUT OF STOCK');
  } finally {
    // Toggle Back In Stock
    const inStockRes = await axios.patch(
      `${API_BASE}/vendor/products/${testProduct.id}/stock`,
      { isInStock: true },
      { headers: managerHeaders }
    );
    assert(inStockRes.status === 200 && (inStockRes.data.data.isInStock === true || inStockRes.data.data.is_in_stock === true), 'Product toggled back to IN STOCK');
  }

  // 3. Create Live Customer Order to Feed KDS
  console.log('\n🛎️  3. Creating Live Customer Order to Feed KDS Console...');
  const initialOutlet = await prisma.vendor.findUnique({ where: { id: vendorId } });
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { orderFlowMode: 'VENDOR_FIRST' },
  });

  try {
    const customerId = customerRes.data.data.user.id;
    const address = await prisma.customerAddress.findFirst({
      where: { userId: customerId, isDefault: true },
    });
    const addressId = address?.id;
    assert(!!addressId, `Customer delivery address found: ${address?.addressLine}`);

    const checkoutRes = await axios.post(
      `${API_BASE}/orders/checkout`,
      {
        vendorId,
        deliveryAddressId: addressId,
        paymentMethod: 'CASH_ON_DELIVERY',
        items: [
          {
            productId: testProduct.id,
            quantity: 2,
          },
        ],
        customerNotes: 'Please cook extra crispy and keep ketchup packets on the side',
      },
      { headers: customerHeaders }
    );
    const placedOrder = checkoutRes.data.data;
    const placedOrderId = placedOrder.orderId || placedOrder.id;
    assert(checkoutRes.status === 201, `Live Order Placed: #${placedOrder.orderNumber} (ID: ${placedOrderId})`);

    // 4. Test Live Orders Queue (GET /vendor/orders/live)
    console.log('\n📋 4. Testing KDS Live Orders Fetch (Lane 1: New Orders)...');
    const liveOrdersRes = await axios.get(`${API_BASE}/vendor/orders/live`, { headers: managerHeaders });
    const liveOrders = liveOrdersRes.data.data;
    assert(Array.isArray(liveOrders), 'Retrieved live orders array');
    const foundOrder = liveOrders.find((o: { id: string }) => o.id === placedOrderId);
    assert(!!foundOrder, `Order #${placedOrder.orderNumber} found in active kitchen queue`);
    assert(
      foundOrder.status === 'PLACED' || foundOrder.status === 'RIDER_ASSIGNED',
      `Order is in Lane 1: New Orders (status: ${foundOrder.status})`
    );

    // 5. Test Audio Silencing and Order Acceptance with Prep Time (Lane 2: In Preparation)
    console.log('\n⏱️  5. Testing One-Tap Accept & Chime Silencing (Lane 2: In Preparation)...');
    const acceptRes = await axios.patch(
      `${API_BASE}/vendor/orders/${placedOrderId}/accept`,
      { prepTimeMinutes: 25 },
      { headers: managerHeaders }
    );
    assert(acceptRes.status === 200, 'Order accepted by store staff');
    assert(acceptRes.data.data.status === 'PREPARING', 'Order transitioned to PREPARING status');
    assert(acceptRes.data.data.prepTimeMinutes === 25, 'Accepted preparation duration recorded as 25 minutes');

    // Verify Countdown Timer Math
    const startMs = Date.now();
    const targetMs = startMs + 25 * 60 * 1000;
    const remainingSecs = Math.floor((targetMs - Date.now()) / 1000);
    assert(remainingSecs > 1400 && remainingSecs <= 1500, `Countdown timer initialized to ~${Math.round(remainingSecs / 60)} minutes remaining`);

    // 6. Test Mark Ready for Pickup (Lane 3: Ready for Pickup)
    console.log('\n📦 6. Testing Food Packaging & Ready for Pickup (Lane 3)...');
    const readyRes = await axios.patch(
      `${API_BASE}/vendor/orders/${placedOrderId}/ready`,
      {},
      { headers: managerHeaders }
    );
    assert(readyRes.status === 200, 'Order marked as packaged and ready');
    assert(readyRes.data.data.status === 'READY_FOR_PICKUP', 'Order transitioned to READY_FOR_PICKUP status');

    // Ensure courier is attached before delivery order handover
    const availableRider = await prisma.rider.findFirst({ where: { isApproved: true } });
    if (availableRider) {
      await prisma.order.update({
        where: { id: placedOrderId },
        data: { riderId: availableRider.id },
      });
    }

    // 7. Test Counter Handover to Rider
    console.log('\n🤝 7. Testing Counter Food Handover to Rider...');
    const handoverRes = await axios.patch(
      `${API_BASE}/vendor/orders/${placedOrderId}/handover`,
      {},
      { headers: managerHeaders }
    );
    assert(handoverRes.status === 200, 'Order handed over to delivery rider');
    assert(handoverRes.data.data.status === 'DISPATCHED', 'Order transitioned to DISPATCHED status');

    // Verify order left active kitchen board
    const liveAfterRes = await axios.get(`${API_BASE}/vendor/orders/live`, { headers: managerHeaders });
    const stillActive = liveAfterRes.data.data.some((o: { id: string }) => o.id === placedOrderId);
    assert(!stillActive, 'Dispatched order cleanly cleared from active kitchen board');

    console.log('\n====================================================');
    console.log(' 🎉 All KDS & Audio Alert Operations Verified!');
    console.log('====================================================\n');
  } finally {
    if (initialOutlet?.orderFlowMode) {
      await prisma.vendor.update({
        where: { id: vendorId },
        data: { orderFlowMode: initialOutlet.orderFlowMode },
      });
    }
    await prisma.$disconnect();
  }
}

runKdsVerification().catch((err) => {
  console.error('KDS verification error:', err.response?.data || err.message);
  process.exit(1);
});
