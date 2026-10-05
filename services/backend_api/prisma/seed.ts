/**
 * DeliveryOS — canonical production-realistic seed.
 *
 * One idempotent seeder covering every model and every practical case:
 * all 4 system settings, 5 outlet types (one deactivated with assigned
 * outlets → customer-hiding demo), 6 brands / 12 outlets with mixed flow
 * modes, 2-tier vendor staff, ~50 products with variants, all banner link
 * types, 7 coupon cases, ~98 orders across every live FSM state over 30
 * days with realistic weekend/diurnal timing, paired financial ledgers,
 * 2 settlement batches, cash deposits in all 3 verification states,
 * gateway payment rows, and media library entries.
 *
 * Deterministic: a fixed-seed LCG makes every run produce identical data.
 * Re-runnable: reference data is upserted; transactional data (orders,
 * ledgers, payments, batches, deposits) is wiped and recreated.
 */
import {
  PrismaClient,
  AccountStatus,
  BannerLinkType,
  CashDepositStatus,
  DiscountType,
  OrderFlowMode,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PermissionScope,
  SettlementStatus,
  UserRole,
  Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const OTP_LOGIN_NOTE = 'OTP 123456 (dev SMS mock)';

// ---------------------------------------------------------------------------
// Deterministic PRNG (LCG) + helpers
// ---------------------------------------------------------------------------
let randState = 20261005;
function rand(): number {
  randState = (randState * 1664525 + 1013904223) % 4294967296;
  return randState / 4294967296;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function at(base: Date, offsetMs: number): Date {
  return new Date(base.getTime() + offsetMs);
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function fail(message: string): never {
  console.error(`\n❌ SEED RECONCILIATION FAILURE: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------
const OUTLET_TYPES = [
  { name: 'Restaurant', slug: 'restaurant', sortOrder: 0, isActive: true },
  { name: 'Super Shop', slug: 'super-shop', sortOrder: 1, isActive: true },
  { name: 'Grocery', slug: 'grocery', sortOrder: 2, isActive: true },
  { name: 'Pharmacy', slug: 'pharmacy', sortOrder: 3, isActive: true },
  // Deactivated business type: both its outlets stay administrable but are
  // hidden from customer discovery (ADR-019 soft control demo).
  { name: 'Cafe', slug: 'cafe', sortOrder: 4, isActive: false },
];

const BRANDS = [
  { name: 'Burger Point', logo: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200' },
  { name: 'FreshMart Daily', logo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200' },
  { name: 'Khaas Biryani House', logo: 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=200' },
  { name: 'GreenGrocer', logo: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=200' },
  { name: 'HealthPlus Pharmacy', logo: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200' },
  { name: 'Chillox Cafe', logo: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200' },
];

interface ProductSpec {
  name: string;
  price: number;
  unit?: string;
  desc?: string;
  outOfStock?: boolean;
  variants?: Array<{ name: string; price: number; outOfStock?: boolean }>;
}
interface CategorySpec {
  name: string;
  products: ProductSpec[];
}
interface OutletSpec {
  name: string;
  brand: string;
  typeSlug: string;
  mode: OrderFlowMode;
  phone: string;
  lat: number;
  lng: number;
  address: string;
  commission: number;
  radius: number;
  prep: number;
  banner?: string;
  isActive?: boolean;
  closedDay?: number;
  categories: CategorySpec[];
}

const BURGER_CATS: CategorySpec[] = [
  {
    name: 'Gourmet Burgers',
    products: [
      {
        name: 'Classic Beef Cheeseburger',
        price: 320,
        desc: 'Flame-grilled beef patty, cheddar, house sauce',
        variants: [
          { name: 'Single Patty', price: 320 },
          { name: 'Double Patty', price: 480 },
        ],
      },
      { name: 'Smoky BBQ Burger', price: 350, desc: 'Slow-cooked beef, BBQ glaze, caramelized onions' },
      { name: 'Crispy Chicken Burger', price: 280, desc: 'Buttermilk-fried chicken thigh, slaw' },
    ],
  },
  {
    name: 'Crispy Sides & Fries',
    products: [
      { name: 'French Fries (Regular)', price: 120 },
      { name: 'Onion Rings (8 pcs)', price: 150, outOfStock: true },
      { name: 'Chicken Nuggets (6 pcs)', price: 180 },
    ],
  },
  {
    name: 'Drinks & Shakes',
    products: [
      { name: 'Coca-Cola (330ml)', price: 40, unit: 'can' },
      { name: 'Mango Lassi', price: 90 },
    ],
  },
];

const BIRYANI_CATS: CategorySpec[] = [
  {
    name: 'Signature Biryani',
    products: [
      {
        name: 'Kacchi Biryani',
        price: 380,
        desc: 'Aged basmati, marinated mutton, aloo',
        variants: [
          { name: 'Full (Single)', price: 380 },
          { name: 'Family Pack (4)', price: 1350 },
        ],
      },
      { name: 'Chicken Biryani', price: 260 },
      { name: 'Beef Tehari', price: 220 },
    ],
  },
  {
    name: 'Kebab & Sides',
    products: [
      { name: 'Seekh Kebab (4 pcs)', price: 240 },
      { name: 'Borhani (Glass)', price: 70 },
    ],
  },
];

const SUPERMARKET_CATS: CategorySpec[] = [
  {
    name: 'Fresh Farm Produce',
    products: [
      { name: 'Bananas', price: 90, unit: 'dozen' },
      { name: 'Red Tomatoes', price: 65, unit: 'kg' },
      { name: 'Spinach Bundle', price: 40, unit: 'bundle' },
    ],
  },
  {
    name: 'Dairy & Eggs',
    products: [
      { name: 'Farm Eggs', price: 130, unit: 'dozen' },
      { name: 'Full Cream Milk 1L', price: 95, unit: 'litre' },
    ],
  },
  {
    name: 'Pantry Staples',
    products: [
      { name: 'Basmati Rice 5kg', price: 620, unit: 'bag' },
      { name: 'Mustard Oil 1L', price: 190, unit: 'litre' },
    ],
  },
];

const GROCERY_CATS: CategorySpec[] = [
  {
    name: 'Seasonal Produce',
    products: [
      { name: 'Hilsa Fish (Large)', price: 850, unit: 'piece' },
      { name: 'Green Chillies', price: 30, unit: '100g' },
      { name: 'Potatoes', price: 45, unit: 'kg' },
    ],
  },
  {
    name: 'Household',
    products: [
      { name: 'Dishwashing Liquid 500ml', price: 110 },
      { name: 'Laundry Detergent 1kg', price: 210 },
    ],
  },
];

const PHARMACY_CATS: CategorySpec[] = [
  {
    name: 'Wellness Essentials',
    products: [
      { name: 'Paracetamol 500mg', price: 30, unit: 'strip' },
      { name: 'Vitamin C 1000mg (10s)', price: 110 },
      { name: 'ORS Saline', price: 8, unit: 'pack' },
    ],
  },
  {
    name: 'Baby Care',
    products: [
      { name: 'Baby Diapers (M, 42s)', price: 480, outOfStock: true },
      { name: 'Baby Lotion 200ml', price: 260 },
    ],
  },
];

const CAFE_CATS: CategorySpec[] = [
  {
    name: 'Coffee & Coolers',
    products: [
      {
        name: 'Cold Coffee',
        price: 180,
        variants: [
          { name: 'Regular', price: 180 },
          { name: 'Large', price: 240 },
        ],
      },
      { name: 'Lemon Mint Cooler', price: 140 },
    ],
  },
  {
    name: 'Bakery Bites',
    products: [
      { name: 'Chocolate Fudge Cake (Slice)', price: 220 },
      { name: 'Cheesecake (Slice)', price: 260 },
    ],
  },
];

const OUTLETS: OutletSpec[] = [
  {
    name: 'Burger Point — Gulshan Branch', brand: 'Burger Point', typeSlug: 'restaurant',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000001', lat: 23.7925, lng: 90.4078,
    address: 'Plot 15, Block CWN(A), Kamal Ataturk Ave, Gulshan 2, Dhaka',
    commission: 15, radius: 5, prep: 20, banner: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
    categories: BURGER_CATS,
  },
  {
    name: 'Burger Point — Dhanmondi Branch', brand: 'Burger Point', typeSlug: 'restaurant',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000002', lat: 23.7461, lng: 90.3742,
    address: 'Road 27, Dhanmondi, Dhaka', commission: 15, radius: 4.5, prep: 25,
    categories: [BURGER_CATS[0], BURGER_CATS[2]],
  },
  {
    // Deliberate per-outlet swap: a restaurant running traditional retail flow.
    name: 'Burger Point — Uttara Branch', brand: 'Burger Point', typeSlug: 'restaurant',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000012', lat: 23.8759, lng: 90.3795,
    address: 'Sector 4, Road 7, Uttara, Dhaka', commission: 15, radius: 5, prep: 20,
    categories: [BURGER_CATS[0], BURGER_CATS[1]],
  },
  {
    name: 'FreshMart Daily — Gulshan Hub', brand: 'FreshMart Daily', typeSlug: 'super-shop',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000003', lat: 23.7912, lng: 90.4065,
    address: 'Gulshan 1 DCC Market, Dhaka', commission: 10, radius: 6, prep: 15,
    banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    categories: SUPERMARKET_CATS,
  },
  {
    name: 'FreshMart Daily — Mirpur Hub', brand: 'FreshMart Daily', typeSlug: 'super-shop',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000013', lat: 23.8042, lng: 90.3687,
    address: 'Mirpur 10 Circle, Dhaka', commission: 10, radius: 6, prep: 15,
    categories: [SUPERMARKET_CATS[0], SUPERMARKET_CATS[1]],
  },
  {
    name: 'Khaas Biryani House — Banani Kitchen', brand: 'Khaas Biryani House', typeSlug: 'restaurant',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000004', lat: 23.7936, lng: 90.4043,
    address: 'Road 11, Banani, Dhaka', commission: 18, radius: 5, prep: 30,
    banner: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800',
    categories: BIRYANI_CATS,
  },
  {
    // Deliberate swap: a grocery outlet running zero-food-waste rider-first.
    name: 'GreenGrocer — Banani Fresh', brand: 'GreenGrocer', typeSlug: 'grocery',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000005', lat: 23.7941, lng: 90.4025,
    address: 'Road 12, Banani, Dhaka', commission: 12, radius: 4, prep: 15,
    categories: GROCERY_CATS,
  },
  {
    name: 'GreenGrocer — Dhanmondi Fresh', brand: 'GreenGrocer', typeSlug: 'grocery',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000015', lat: 23.7491, lng: 90.3771,
    address: 'Road 5, Dhanmondi, Dhaka', commission: 12, radius: 4, prep: 15,
    isActive: false, closedDay: 5, // suspended outlet + Friday weekly closed day
    categories: GROCERY_CATS,
  },
  {
    name: 'HealthPlus Pharmacy — Gulshan', brand: 'HealthPlus Pharmacy', typeSlug: 'pharmacy',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000006', lat: 23.7908, lng: 90.4092,
    address: 'Gulshan 2 Circle, Dhaka', commission: 8, radius: 6, prep: 10,
    categories: PHARMACY_CATS,
  },
  {
    name: 'HealthPlus Pharmacy — Uttara', brand: 'HealthPlus Pharmacy', typeSlug: 'pharmacy',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000016', lat: 23.8788, lng: 90.3826,
    address: 'Sector 7, Uttara, Dhaka', commission: 8, radius: 6, prep: 10,
    categories: [PHARMACY_CATS[0]],
  },
  {
    name: 'Chillox Cafe — Banani', brand: 'Chillox Cafe', typeSlug: 'cafe',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000007', lat: 23.795, lng: 90.401,
    address: 'Road 11, Banani, Dhaka', commission: 15, radius: 4, prep: 20,
    categories: CAFE_CATS,
  },
  {
    name: 'Chillox Cafe — Dhanmondi', brand: 'Chillox Cafe', typeSlug: 'cafe',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000017', lat: 23.747, lng: 90.3755,
    address: 'Road 8, Dhanmondi, Dhaka', commission: 15, radius: 4, prep: 20,
    categories: CAFE_CATS,
  },
];

const EXTRA_RIDERS = [
  { phone: '+8801700000030', name: 'Jashim Uddin' },
  { phone: '+8801700000031', name: 'Farhan Akash' },
  { phone: '+8801700000032', name: 'Sohel Rana' },
  { phone: '+8801700000033', name: 'Mizanur Rahman' },
  { phone: '+8801700000034', name: 'Rakib Hossain' },
  { phone: '+8801700000035', name: 'Nasir Islam' },
  { phone: '+8801700000036', name: 'Arif Chowdhury' },
  { phone: '+8801700000037', name: 'Dipu Mondol' },
  { phone: '+8801700000038', name: 'Kamal Hossain' },
  { phone: '+8801700000039', name: 'Shahin Alam' },
  { phone: '+8801700000040', name: 'Rasel Mia' },
  { phone: '+8801700000041', name: 'Titu Roy' },
  { phone: '+8801700000042', name: 'Abdur Karim' },
  { phone: '+8801700000043', name: 'Milon Sheikh' },
];

const EXTRA_CUSTOMERS = [
  { phone: '+8801700000050', name: 'Nusrat Jahan' },
  { phone: '+8801700000051', name: 'Sabbir Ahmed' },
  { phone: '+8801700000052', name: 'Mitu Karim' },
  { phone: '+8801700000053', name: 'Rownak Jahan' },
  { phone: '+8801700000054', name: 'Tanvir Ahmed' },
  { phone: '+8801700000055', name: 'Shapla Begum' },
  { phone: '+8801700000056', name: 'Ridoy Hasan' },
  { phone: '+8801700000057', name: 'Farzana Akter' },
  { phone: '+8801700000058', name: 'Mahin Sarkar' },
  { phone: '+8801700000059', name: 'Sumaiya Islam' },
  { phone: '+8801700000060', name: 'Rakibul Hasan' },
  { phone: '+8801700000061', name: 'Nadia Kabir' },
  { phone: '+8801700000062', name: 'Imran Hossain' },
  { phone: '+8801700000063', name: 'Tasnim Rahman' },
  { phone: '+8801700000064', name: 'Zahid Hasan' },
  { phone: '+8801700000065', name: 'Mim Akter' },
  { phone: '+8801700000066', name: 'Sajid Khan' },
  { phone: '+8801700000067', name: 'Rehana Parvin' },
  { phone: '+8801700000068', name: 'Ovi Chowdhury' },
  { phone: '+8801700000070', name: 'Piyash Ali' },
  { phone: '+8801700000071', name: 'Snigdha Roy' },
  { phone: '+8801700000072', name: 'Hamid Rahman' },
];

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

async function main() {
  const now = new Date();
  console.log('🌱 DeliveryOS production-realistic seeder starting...\n');

  // -------------------------------------------------------------------------
  // 0. Wipe transactional data (reference data below is upserted, not wiped)
  // -------------------------------------------------------------------------
  await prisma.payment.deleteMany({});
  await prisma.commissionLedger.deleteMany({});
  await prisma.riderTripLedger.deleteMany({});
  await prisma.settlementBatch.deleteMany({});
  await prisma.cashDeposit.deleteMany({});
  await prisma.order.deleteMany({});
  console.log('🧹 Transactional data wiped (orders, ledgers, payments, batches, deposits).');

  // -------------------------------------------------------------------------
  // 1. System settings (all four keys, current payload shapes)
  // -------------------------------------------------------------------------
  console.log('⚙️  Seeding system settings...');
  await prisma.systemSetting.upsert({
    where: { key: 'dispatch_config' },
    update: { value: { rider_search_timeout_seconds: 90, stale_order_ttl_minutes: 60 } },
    create: {
      key: 'dispatch_config',
      value: { rider_search_timeout_seconds: 90, stale_order_ttl_minutes: 60 },
      description: 'Dispatch timing (rider search timeout, stale-order TTL)',
    },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'delivery_fee_config' },
    update: {
      value: { mode: 'FIXED_FLAT', flatFee: 50.0, baseFee: 30.0, baseKm: 2.0, perKmRate: 10.0 },
    },
    create: {
      key: 'delivery_fee_config',
      value: { mode: 'FIXED_FLAT', flatFee: 50.0, baseFee: 30.0, baseKm: 2.0, perKmRate: 10.0 },
      description: 'Customer delivery fee engine',
    },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'delivery_economics' },
    update: { value: { rider_share_percent: 80, eta_avg_speed_kmh: 25, eta_fallback_minutes: 10 } },
    create: {
      key: 'delivery_economics',
      value: { rider_share_percent: 80, eta_avg_speed_kmh: 25, eta_fallback_minutes: 10 },
      description: 'Rider payout share and ETA assumptions',
    },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'region_config' },
    update: { value: { primary_region: 'BD', currencies: ['BDT'], secondary_regions: ['KSA'] } },
    create: {
      key: 'region_config',
      value: { primary_region: 'BD', currencies: ['BDT'], secondary_regions: ['KSA'] },
      description: 'Regional pilot configuration',
    },
  });

  // -------------------------------------------------------------------------
  // 2. Outlet types (ADR-019) — Cafe deactivated with outlets assigned
  // -------------------------------------------------------------------------
  console.log('🏷️  Seeding outlet types...');
  const typeBySlug = new Map<string, string>();
  for (const t of OUTLET_TYPES) {
    const row = await prisma.outletType.upsert({
      where: { slug: t.slug },
      update: { name: t.name, sortOrder: t.sortOrder, isActive: t.isActive },
      create: t,
    });
    typeBySlug.set(t.slug, row.id);
  }

  // -------------------------------------------------------------------------
  // 3. Brands, outlets, menus, schedules
  // -------------------------------------------------------------------------
  console.log('🏬 Seeding brands, outlets, menus, and schedules...');
  const brandByName = new Map<string, string>();
  for (const b of BRANDS) {
    const existing = await prisma.vendorBrand.findFirst({ where: { name: b.name } });
    const row = existing
      ? await prisma.vendorBrand.update({ where: { id: existing.id }, data: { logoUrl: b.logo } })
      : await prisma.vendorBrand.create({ data: { name: b.name, logoUrl: b.logo } });
    brandByName.set(b.name, row.id);
  }

  const outletRows: Array<{ id: string; spec: OutletSpec }> = [];
  const productsByOutlet = new Map<string, Array<{ id: string; name: string; price: number }>>();
  for (const spec of OUTLETS) {
    const brandLogo = BRANDS.find((b) => b.name === spec.brand)?.logo ?? null;
    const data = {
      brandId: brandByName.get(spec.brand) as string,
      typeId: typeBySlug.get(spec.typeSlug) as string,
      name: spec.name,
      contactPhone: spec.phone,
      logoUrl: brandLogo,
      bannerUrl: spec.banner ?? null,
      latitude: spec.lat,
      longitude: spec.lng,
      addressText: spec.address,
      commissionRate: spec.commission,
      deliveryRadiusKm: spec.radius,
      defaultPrepTimeMinutes: spec.prep,
      orderFlowMode: spec.mode,
      isActive: spec.isActive ?? true,
    };
    const existing = await prisma.vendor.findFirst({ where: { name: spec.name } });
    const outlet = existing
      ? await prisma.vendor.update({ where: { id: existing.id }, data })
      : await prisma.vendor.create({ data });
    outletRows.push({ id: outlet.id, spec });

    for (const [ci, cat] of spec.categories.entries()) {
      let category = await prisma.category.findFirst({ where: { vendorId: outlet.id, name: cat.name } });
      if (!category) {
        category = await prisma.category.create({
          data: { vendorId: outlet.id, name: cat.name, sortOrder: ci + 1, isActive: true },
        });
      }
      const list: Array<{ id: string; name: string; price: number }> = [];
      for (const [pi, p] of cat.products.entries()) {
        const pdata = {
          vendorId: outlet.id,
          categoryId: category.id,
          name: p.name,
          description: p.desc ?? null,
          basePrice: p.price,
          unitType: p.unit ?? 'piece',
          isInStock: !p.outOfStock,
          sortOrder: pi + 1,
        };
        const existingProduct = await prisma.product.findFirst({ where: { vendorId: outlet.id, name: p.name } });
        const product = existingProduct
          ? await prisma.product.update({ where: { id: existingProduct.id }, data: pdata })
          : await prisma.product.create({ data: pdata });
        if (p.variants?.length) {
          for (const [vi, v] of p.variants.entries()) {
            const existingVariant = await prisma.productVariant.findFirst({
              where: { productId: product.id, name: v.name },
            });
            const vdata = { price: v.price, isInStock: !v.outOfStock, sortOrder: vi + 1 };
            if (existingVariant) {
              await prisma.productVariant.update({ where: { id: existingVariant.id }, data: vdata });
            } else {
              await prisma.productVariant.create({
                data: { productId: product.id, name: v.name, ...vdata },
              });
            }
          }
        }
        list.push({ id: product.id, name: product.name, price: p.price });
      }
      const prev = productsByOutlet.get(outlet.id) ?? [];
      productsByOutlet.set(outlet.id, [...prev, ...list]);
    }

    // 7-day operating schedule (one outlet keeps a weekly closed day)
    const closed = (d: number) => spec.closedDay === d;
    for (let d = 0; d <= 6; d++) {
      const hours = {
        openTime: closed(d) ? '00:00:00' : '10:00:00',
        closeTime: closed(d) ? '00:00:00' : '22:00:00',
        isClosed: closed(d),
      };
      await prisma.vendorOperatingHour.upsert({
        where: { vendorId_dayOfWeek: { vendorId: outlet.id, dayOfWeek: d } },
        update: hours,
        create: { vendorId: outlet.id, dayOfWeek: d, ...hours },
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Users: super admin, vendor staff (both scopes), riders, customers
  // -------------------------------------------------------------------------
  console.log('👥 Seeding users...');
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+8801700000001' },
    update: { fullName: 'Ashraf Rahman', status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000001', fullName: 'Ashraf Rahman', role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const gulshanId = outletRows[0].id;
  const staffSeed = [
    { phone: '+8801700000002', name: 'Rahim Chowdhury', scope: PermissionScope.PARTICULAR_OUTLET, vendorId: gulshanId },
    { phone: '+8801700000003', name: 'Karim Chowdhury', scope: PermissionScope.ALL_OUTLETS_MASTER, brandName: 'Burger Point' },
    { phone: '+8801700000020', name: 'Shirin Sultana', scope: PermissionScope.ALL_OUTLETS_MASTER, brandName: 'FreshMart Daily' },
    { phone: '+8801700000021', name: 'Nayan Mia', scope: PermissionScope.PARTICULAR_OUTLET, vendorId: outletRows[8].id },
  ];
  for (const s of staffSeed) {
    const user = await prisma.user.upsert({
      where: { phone: s.phone },
      update: { fullName: s.name, status: AccountStatus.ACTIVE },
      create: {
        phone: s.phone, fullName: s.name, role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE,
      },
    });
    const existing = await prisma.vendorStaff.findFirst({ where: { userId: user.id } });
    if (!existing) {
      await prisma.vendorStaff.create({
        data: {
          userId: user.id,
          vendorId: s.vendorId ?? null,
          brandId: s.brandName ? brandByName.get(s.brandName) ?? null : null,
          scope: s.scope,
          isActive: true,
        },
      });
    }
  }

  // Riders — 15 total incl. 2 pending applicants queued for admin approval
  console.log('🛵 Seeding riders...');
  const baseRiderUser = await prisma.user.upsert({
    where: { phone: '+8801700000004' },
    update: { fullName: 'Tanvir Hasan (Rider)', status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000004', fullName: 'Tanvir Hasan (Rider)', role: UserRole.RIDER,
      status: AccountStatus.ACTIVE,
    },
  });
  interface RiderRow { id: string; userId: string; approved: boolean }
  const riderRows: RiderRow[] = [];
  {
    const base = await prisma.rider.upsert({
      where: { userId: baseRiderUser.id },
      update: { isApproved: true, isOnline: true, vehicleType: 'motorcycle' },
      create: {
        userId: baseRiderUser.id, vehicleType: 'motorcycle', isOnline: true,
        isApproved: true, cashInHand: 0, maxCashLimit: 5000,
        latitude: 23.793, longitude: 90.4081,
      },
    });
    riderRows.push({ id: base.id, userId: baseRiderUser.id, approved: true });
    for (const [i, r] of EXTRA_RIDERS.entries()) {
      const applicant = i >= EXTRA_RIDERS.length - 2;
      const approved = !applicant;
      const online = approved && [0, 1, 3, 5, 8].includes(i);
      const vehicle = i % 7 === 3 ? 'bicycle' : 'motorcycle';
      const user = await prisma.user.upsert({
        where: { phone: r.phone },
        update: {
          fullName: r.name,
          status: applicant ? AccountStatus.PENDING_APPROVAL : AccountStatus.ACTIVE,
        },
        create: {
          phone: r.phone, fullName: r.name, role: UserRole.RIDER,
          status: applicant ? AccountStatus.PENDING_APPROVAL : AccountStatus.ACTIVE,
        },
      });
      const rdata = {
        vehicleType: vehicle,
        isOnline: online,
        isApproved: approved,
        cashInHand: 0,
        maxCashLimit: 5000,
        latitude: online ? 23.79 + rand() * 0.02 : null,
        longitude: online ? 90.4 + rand() * 0.02 : null,
      };
      const row = await prisma.rider.upsert({
        where: { userId: user.id },
        update: rdata,
        create: { userId: user.id, ...rdata },
      });
      riderRows.push({ id: row.id, userId: user.id, approved });
    }
  }
  const approvedRiders = riderRows.filter((r) => r.approved);

  // Customers — 24 active + 1 suspended (23 named + demo + suspended)
  console.log('🧑‍🤝‍🧑 Seeding customers...');
  const customerRows: Array<{ id: string; phone: string }> = [];
  const demoCustomer = await prisma.user.upsert({
    where: { phone: '+8801700000005' },
    update: { fullName: 'Rahim Uddin', status: AccountStatus.ACTIVE, suspensionReason: null },
    create: {
      phone: '+8801700000005', fullName: 'Rahim Uddin', role: UserRole.CUSTOMER,
      status: AccountStatus.ACTIVE,
    },
  });
  customerRows.push({ id: demoCustomer.id, phone: demoCustomer.phone });
  for (const c of EXTRA_CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { phone: c.phone },
      update: { fullName: c.name, status: AccountStatus.ACTIVE, suspensionReason: null },
      create: {
        phone: c.phone, fullName: c.name, role: UserRole.CUSTOMER, status: AccountStatus.ACTIVE,
      },
    });
    customerRows.push({ id: user.id, phone: user.phone });
  }
  await prisma.user.upsert({
    where: { phone: '+8801700000073' },
    update: { status: AccountStatus.SUSPENDED, suspensionReason: 'Repeated fraudulent refund claims' },
    create: {
      phone: '+8801700000073', fullName: 'Shamim Reza', role: UserRole.CUSTOMER,
      status: AccountStatus.SUSPENDED, suspensionReason: 'Repeated fraudulent refund claims',
    },
  });

  // One saved address per active customer (Banani/Gulshan service zone)
  for (const c of customerRows) {
    const data = {
      label: pick(['Home', 'Work', 'Home', 'Home']),
      addressLine: pick([
        'House 12, Road 11, Banani, Dhaka',
        'Plot 5, Block C, Niketon, Gulshan, Dhaka',
        'House 34, Road 27, Dhanmondi, Dhaka',
        'Apartment 4B, Road 41, Gulshan 2, Dhaka',
      ]),
      latitude: 23.789 + rand() * 0.018,
      longitude: 90.399 + rand() * 0.014,
      isDefault: true,
    };
    const existing = await prisma.customerAddress.findFirst({ where: { userId: c.id } });
    if (existing) {
      await prisma.customerAddress.update({ where: { id: existing.id }, data });
    } else {
      await prisma.customerAddress.create({ data: { userId: c.id, ...data } });
    }
  }
  const addresses = await prisma.customerAddress.findMany({
    where: { userId: { in: customerRows.map((c) => c.id) } },
  });
  const addrByCustomer = new Map(addresses.map((a) => [a.userId, a]));

  // -------------------------------------------------------------------------
  // 5. Promotions: banners (all 4 link types + schedule cases) & coupons
  // -------------------------------------------------------------------------
  console.log('🖼️  Seeding banners and coupons...');
  const biryaniCat = await prisma.category.findFirst({ where: { name: 'Signature Biryani' } });
  const bannerSeed = [
    {
      title: 'Burger Point Gulshan Grand Opening', linkType: BannerLinkType.OUTLET,
      targetId: gulshanId, sortOrder: 1, startsAt: at(now, -20 * DAY),
      endsAt: at(now, 10 * DAY), imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200',
    },
    {
      title: 'Biryani Nights Are Here', linkType: BannerLinkType.CATEGORY,
      targetId: biryaniCat?.id ?? null, sortOrder: 2, startsAt: at(now, -10 * DAY),
      endsAt: at(now, 20 * DAY), imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=1200',
    },
    {
      title: 'Ramadan Mega Deals', linkType: BannerLinkType.EXTERNAL,
      targetUrl: 'https://example.com/campaigns/ramadan', sortOrder: 3,
      startsAt: at(now, -5 * DAY), endsAt: at(now, 12 * DAY),
      imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200',
    },
    {
      title: 'Refer a Friend, Earn 100', linkType: BannerLinkType.INTERNAL,
      targetUrl: '/profile', sortOrder: 4, startsAt: at(now, -3 * DAY),
      endsAt: at(now, 30 * DAY), imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200',
    },
    {
      title: 'Coming Soon: Winter Feast', linkType: BannerLinkType.INTERNAL,
      targetUrl: '/orders', sortOrder: 5, startsAt: at(now, 3 * DAY),
      endsAt: at(now, 40 * DAY), imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1200',
    },
    {
      title: 'Expired Summer Splash', linkType: BannerLinkType.INTERNAL,
      targetUrl: '/orders', sortOrder: 6, startsAt: at(now, -60 * DAY),
      endsAt: at(now, -30 * DAY), imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=1200',
    },
  ];
  for (const b of bannerSeed) {
    const existing = await prisma.banner.findFirst({ where: { title: b.title } });
    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data: { ...b, isActive: true } });
    } else {
      await prisma.banner.create({ data: { ...b, isActive: true } });
    }
  }

  const couponSeed = [
    {
      code: 'WELCOME50', description: '10% off your first order (max ৳200)', type: DiscountType.PERCENTAGE,
      value: 10, min: 200, cap: 200, limit: 500, from: -30, to: 60,
    },
    {
      code: 'BURGER20', description: '৳20 off any burger order over ৳150', type: DiscountType.FLAT,
      value: 20, min: 150, cap: null, limit: 1000, from: -30, to: 60,
    },
    {
      code: 'GROCERY10', description: '5% off groceries (max ৳100)', type: DiscountType.PERCENTAGE,
      value: 5, min: 500, cap: 100, limit: 500, from: -25, to: 35,
    },
    {
      code: 'PHARMA15', description: '৳15 off pharmacy orders over ৳300', type: DiscountType.FLAT,
      value: 15, min: 300, cap: null, limit: 300, from: -20, to: 40,
    },
    {
      code: 'SAVEBIG200', description: '15% off big baskets — currently disabled', type: DiscountType.PERCENTAGE,
      value: 15, min: 1000, cap: 200, limit: 200, from: -30, to: 60, isActive: false,
    },
    {
      code: 'FLASH30', description: 'Expired flash sale — ৳30 off', type: DiscountType.FLAT,
      value: 30, min: 100, cap: null, limit: 200, from: -45, to: -2,
    },
    {
      code: 'FIRSTX2', description: '৳50 off — fully redeemed (limit reached)', type: DiscountType.FLAT,
      value: 50, min: 200, cap: null, limit: 2, from: -30, to: 60, exhausted: true,
    },
  ];
  const couponRows = new Map<string, { id: string; type: DiscountType; value: number; cap: number | null }>();
  for (const c of couponSeed) {
    const data = {
      code: c.code, description: c.description, discountType: c.type,
      discountValue: c.value, minOrderAmount: c.min,
      maxDiscountAmount: c.cap, usageLimit: c.limit,
      currentUses: c.exhausted ? c.limit : 0,
      validFrom: at(now, c.from * DAY), validTo: at(now, c.to * DAY),
      isActive: c.isActive ?? true,
    };
    const row = await prisma.coupon.upsert({ where: { code: c.code }, update: data, create: data });
    couponRows.set(c.code, { id: row.id, type: c.type, value: c.value, cap: c.cap });
  }

  // Media library entries for the seeded campaign artwork
  console.log('🗂️  Seeding media assets...');
  for (const b of bannerSeed.slice(0, 4)) {
    const existing = await prisma.mediaAsset.findFirst({ where: { url: b.imageUrl } });
    if (!existing) {
      await prisma.mediaAsset.create({
        data: {
          url: b.imageUrl,
          filename: `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`,
          originalName: `${b.title}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: randInt(120_000, 480_000),
          width: 1200,
          height: 630,
          uploadedById: superAdmin.id,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // 6. Orders — 30 days of history + live pipeline + cancellations
  // -------------------------------------------------------------------------
  console.log('📦 Generating orders, ledgers, payments, settlements, deposits...');

  type PlannedStatus =
    | { kind: 'DELIVERED'; dayBack: number }
    | { kind: 'CANCELLED'; dayBack: number; fromStatus: OrderStatus; refund: boolean; paymentFailed?: boolean }
    | { kind: 'LIVE'; status: OrderStatus };
  const plan: PlannedStatus[] = [];

  for (let i = 0; i < 80; i++) {
    plan.push({ kind: 'DELIVERED', dayBack: Math.floor(rand() * 28) });
  }
  // Weekend boost: extra deliveries landing on Fri/Sat history
  for (const weekendBack of [2, 3, 5, 6, 9, 10, 12, 13, 16, 17, 19, 20, 23, 24, 26, 27]) {
    plan.push({ kind: 'DELIVERED', dayBack: weekendBack });
  }
  // 8 cancellations across stages and payment outcomes
  plan.push({ kind: 'CANCELLED', dayBack: 12, fromStatus: OrderStatus.PLACED, refund: false });
  plan.push({ kind: 'CANCELLED', dayBack: 9, fromStatus: OrderStatus.PLACED, refund: false });
  plan.push({ kind: 'CANCELLED', dayBack: 7, fromStatus: OrderStatus.RIDER_ASSIGNED, refund: false });
  plan.push({ kind: 'CANCELLED', dayBack: 5, fromStatus: OrderStatus.PREPARING, refund: false });
  plan.push({ kind: 'CANCELLED', dayBack: 3, fromStatus: OrderStatus.READY_FOR_PICKUP, refund: false });
  plan.push({ kind: 'CANCELLED', dayBack: 6, fromStatus: OrderStatus.PREPARING, refund: true });
  plan.push({ kind: 'CANCELLED', dayBack: 2, fromStatus: OrderStatus.RIDER_ASSIGNED, refund: true });
  plan.push({ kind: 'CANCELLED', dayBack: 1, fromStatus: OrderStatus.PLACED, refund: false, paymentFailed: true });
  // 10 live pipeline orders — claimable states respect the outlet's flow mode
  plan.push({ kind: 'LIVE', status: OrderStatus.PLACED });                    // RIDER_FIRST outlets
  plan.push({ kind: 'LIVE', status: OrderStatus.PLACED });
  plan.push({ kind: 'LIVE', status: OrderStatus.RIDER_ASSIGNED });
  plan.push({ kind: 'LIVE', status: OrderStatus.RIDER_ASSIGNED });
  plan.push({ kind: 'LIVE', status: OrderStatus.PREPARING });
  plan.push({ kind: 'LIVE', status: OrderStatus.PREPARING });
  plan.push({ kind: 'LIVE', status: OrderStatus.READY_FOR_PICKUP });          // VENDOR_FIRST outlets
  plan.push({ kind: 'LIVE', status: OrderStatus.READY_FOR_PICKUP });
  plan.push({ kind: 'LIVE', status: OrderStatus.DISPATCHED });
  plan.push({ kind: 'LIVE', status: OrderStatus.DISPATCHED });

  const orderableOutlets = outletRows.filter((o) => o.spec.isActive ?? true);
  const riderFirstOutlets = orderableOutlets.filter((o) => o.spec.mode === OrderFlowMode.RIDER_FIRST);
  const vendorFirstOutlets = orderableOutlets.filter((o) => o.spec.mode === OrderFlowMode.VENDOR_FIRST);

  function chooseOutlet(status: OrderStatus): { id: string; spec: OutletSpec } {
    if (status === OrderStatus.PLACED) return pick(riderFirstOutlets);
    if (status === OrderStatus.READY_FOR_PICKUP) return pick(vendorFirstOutlets);
    return pick(orderableOutlets);
  }

  const seqByDay = new Map<string, number>();
  function nextOrderNumber(placedAt: Date): string {
    const key = dateStr(placedAt);
    const seq = (seqByDay.get(key) ?? 0) + 1;
    seqByDay.set(key, seq);
    return `ORD-${key}-${String(seq).padStart(4, '0')}`;
  }

  interface CreatedOrder {
    id: string; orderNumber: string; outletId: string; commission: number;
    status: OrderStatus; method: PaymentMethod; paymentStatus: PaymentStatus;
    netSubtotal: number; deliveryFee: number; totalAmount: number;
    riderId: string | null; deliveredAt: Date | null; placedAt: Date; couponCode: string | null;
  }
  const created: CreatedOrder[] = [];

  for (const p of plan) {
    const status: OrderStatus = p.kind === 'DELIVERED' ? OrderStatus.DELIVERED
      : p.kind === 'CANCELLED' ? OrderStatus.CANCELLED
      : p.status;
    const outlet = chooseOutlet(p.kind === 'LIVE' ? status : OrderStatus.PREPARING);
    const products = productsByOutlet.get(outlet.id) ?? [];
    if (products.length === 0) continue;

    const hour = pick([11, 12, 13, 13, 14, 16, 18, 19, 20, 20, 21, 22]);
    const dayBack = p.kind === 'LIVE' ? 0 : p.dayBack;
    let placedAt: Date;
    if (p.kind === 'LIVE') {
      // Fresh enough that the 60-min stale reaper keeps the pipeline alive for demos.
      placedAt = new Date(now.getTime() - randInt(2, 12) * 60_000);
    } else if (dayBack === 0) {
      // Same-day history: safely in the past with the delivery already completed.
      placedAt = new Date(now.getTime() - randInt(90, 420) * 60_000);
    } else {
      placedAt = new Date(now.getTime() - dayBack * DAY);
      placedAt.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
    }

    const customer = pick(customerRows);
    const address = addrByCustomer.get(customer.id);
    const chosen: Array<{ id: string; name: string; price: number; qty: number }> = [];
    for (let i = 0; i < randInt(1, 3); i++) {
      const prod = pick(products);
      if (chosen.some((c) => c.id === prod.id)) continue;
      chosen.push({ ...prod, qty: randInt(1, 2) });
    }
    if (chosen.length === 0) continue;

    const method: PaymentMethod = rand() < 0.42 ? PaymentMethod.ONLINE_GATEWAY : PaymentMethod.CASH_ON_DELIVERY;
    const couponCode = rand() < 0.28 ? pick(['WELCOME50', 'BURGER20', 'GROCERY10', 'PHARMA15']) : null;

    const subtotal = round2(chosen.reduce((s, it) => s + it.price * it.qty, 0));
    const deliveryFee = 50.0;
    let couponDiscount = 0;
    if (couponCode) {
      const c = couponRows.get(couponCode);
      if (c) {
        couponDiscount = c.type === DiscountType.PERCENTAGE
          ? Math.min(round2((subtotal * c.value) / 100), c.cap ?? Number.MAX_SAFE_INTEGER)
          : c.value;
        if (couponDiscount > subtotal) couponDiscount = subtotal;
      }
    }
    const netSubtotal = round2(Math.max(0, subtotal - couponDiscount));
    const totalAmount = round2(netSubtotal + deliveryFee);

    let riderId: string | null = null;
    if (status === OrderStatus.RIDER_ASSIGNED || status === OrderStatus.PREPARING ||
        status === OrderStatus.READY_FOR_PICKUP || status === OrderStatus.DISPATCHED ||
        status === OrderStatus.DELIVERED ||
        (p.kind === 'CANCELLED' && p.fromStatus !== OrderStatus.PLACED)) {
      riderId = pick(approvedRiders).id;
    }

    let paymentStatus: PaymentStatus;
    if (status === OrderStatus.CANCELLED) {
      const c = p as Extract<PlannedStatus, { kind: 'CANCELLED' }>;
      paymentStatus = c.paymentFailed
        ? PaymentStatus.FAILED
        : method === PaymentMethod.ONLINE_GATEWAY
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PENDING;
    } else if (method === PaymentMethod.ONLINE_GATEWAY) {
      paymentStatus = PaymentStatus.PAID; // dispatch invariant: online orders are prepaid
    } else {
      paymentStatus = status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING;
    }

    const orderNumber = nextOrderNumber(placedAt);
    const commissionRate = outlet.spec.commission;
    const commissionAmount = round2((netSubtotal * commissionRate) / 100);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        vendorId: outlet.id,
        riderId,
        couponId: couponCode ? couponRows.get(couponCode)?.id ?? null : null,
        status,
        orderFlowMode: outlet.spec.mode, // immutable snapshot of the outlet's mode
        subtotal,
        couponDiscount,
        deliveryFee,
        taxAmount: 0,
        totalAmount,
        paymentMethod: (p.kind === 'CANCELLED' && p.paymentFailed) ? PaymentMethod.ONLINE_GATEWAY : method,
        paymentStatus,
        deliveryAddressSnapshot: {
          label: address?.label ?? 'Home',
          addressLine: address?.addressLine ?? 'House 12, Road 11, Banani, Dhaka',
          latitude: address?.latitude ?? 23.7937,
          longitude: address?.longitude ?? 90.4043,
          deliveryMethod: 'HOME_DELIVERY',
        } as unknown as Prisma.InputJsonObject,
        customerPhoneSnapshot: customer.phone,
        prepTimeMinutes: outlet.spec.prep,
        customerNotes: rand() < 0.15 ? 'Please ring the bell twice.' : null,
        placedAt,
        acceptedAt: status === OrderStatus.PLACED ? null : at(placedAt, randInt(1, 4) * 60_000),
        pickedUpAt: status === OrderStatus.DISPATCHED || status === OrderStatus.DELIVERED
          ? at(placedAt, randInt(22, 55) * 60_000) : null,
        deliveredAt: status === OrderStatus.DELIVERED ? at(placedAt, randInt(35, 75) * 60_000) : null,
        cancelledAt: status === OrderStatus.CANCELLED ? at(placedAt, randInt(4, 25) * 60_000) : null,
        rejectionReason: null,
      },
    });

    for (const it of chosen) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.id,
          productNameSnapshot: it.name,
          unitPrice: it.price,
          quantity: it.qty,
          totalPrice: round2(it.price * it.qty),
          variantSnapshot: Prisma.JsonNull,
        },
      });
    }

    // Commission ledger exists for every live/delivered order (checkout behavior)
    if (status !== OrderStatus.CANCELLED) {
      await prisma.commissionLedger.create({
        data: {
          orderId: order.id,
          vendorId: outlet.id,
          grossAmount: netSubtotal,
          commissionRate,
          commissionAmount,
          netVendorPayable: round2(netSubtotal - commissionAmount),
          settlementStatus: SettlementStatus.PENDING,
        },
      });
    }

    // Rider trip ledger exists once delivered (rider.service behavior)
    if (status === OrderStatus.DELIVERED && riderId) {
      await prisma.riderTripLedger.create({
        data: {
          orderId: order.id,
          riderId,
          deliveryEarnings: round2(deliveryFee * 0.8),
          codCollected: method === PaymentMethod.CASH_ON_DELIVERY ? totalAmount : 0,
          status: SettlementStatus.PENDING,
        },
      });
    }

    // Gateway payment rows for every ONLINE_GATEWAY order
    if (order.paymentMethod === PaymentMethod.ONLINE_GATEWAY) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: 'sslcommerz',
          transactionId: `TXN-${orderNumber}`,
          sessionKey: `SESS-${orderNumber.slice(-6)}`,
          amount: totalAmount,
          currency: 'BDT',
          status: paymentStatus,
          gatewayResponse: {
            status: paymentStatus, gateway: 'sslcommerz-sandbox', valId: `VAL-${orderNumber}`,
          } as unknown as Prisma.InputJsonObject,
          refundId: paymentStatus === PaymentStatus.REFUNDED ? `REF-${orderNumber}` : null,
          refundedAt: paymentStatus === PaymentStatus.REFUNDED ? order.cancelledAt : null,
          paidAt: paymentStatus === PaymentStatus.PAID ? at(placedAt, 60_000) : null,
          failedAt: paymentStatus === PaymentStatus.FAILED ? at(placedAt, 90_000) : null,
        },
      });
    }

    created.push({
      id: order.id, orderNumber, outletId: outlet.id, commission: commissionRate,
      status, method: order.paymentMethod, paymentStatus,
      netSubtotal, deliveryFee, totalAmount, riderId,
      deliveredAt: order.deliveredAt, placedAt, couponCode,
    });
  }

  // -------------------------------------------------------------------------
  // 7. Settlements: SETTLED (oldest 2 weeks) + PROCESSING (week 3)
  // -------------------------------------------------------------------------
  const deliveredOrders = created.filter(
    (o): o is CreatedOrder & { deliveredAt: Date } =>
      o.status === OrderStatus.DELIVERED && o.deliveredAt !== null,
  );
  const settledCut = at(now, -17 * DAY);
  const processingCut = at(now, -9 * DAY);
  const settledGroup = deliveredOrders.filter((o) => o.deliveredAt < settledCut);
  const processingGroup = deliveredOrders.filter(
    (o) => o.deliveredAt >= settledCut && o.deliveredAt < processingCut,
  );

  async function makeBatch(
    batchNumber: string, start: Date, end: Date,
    group: CreatedOrder[], status: SettlementStatus,
  ) {
    if (group.length === 0) return;
    let vendorPayout = 0;
    let riderPayout = 0;
    let margin = 0;
    for (const o of group) {
      const commission = round2((o.netSubtotal * o.commission) / 100);
      vendorPayout += round2(o.netSubtotal - commission);
      riderPayout += round2(o.deliveryFee * 0.8);
      margin += commission;
    }
    const batch = await prisma.settlementBatch.create({
      data: {
        batchNumber,
        startDate: start,
        endDate: end,
        totalOrders: group.length,
        totalVendorPayout: round2(vendorPayout),
        totalRiderPayout: round2(riderPayout),
        totalPlatformMargin: round2(margin),
        status,
        executedByUserId: superAdmin.id,
        executedAt: end,
      },
    });
    const ids = group.map((o) => o.id);
    await prisma.commissionLedger.updateMany({
      where: { orderId: { in: ids } },
      data: {
        settlementStatus: status,
        settlementBatchId: batch.id,
        settledAt: status === SettlementStatus.SETTLED ? end : null,
      },
    });
    await prisma.riderTripLedger.updateMany({
      where: { orderId: { in: ids } },
      data: { status, settlementBatchId: batch.id },
    });
  }
  await makeBatch(
    `SETTLE-${dateStr(at(now, -30 * DAY))}-001`, at(now, -30 * DAY), settledCut,
    settledGroup, SettlementStatus.SETTLED,
  );
  await makeBatch(
    `SETTLE-${dateStr(settledCut)}-002`, settledCut, processingCut,
    processingGroup, SettlementStatus.PROCESSING,
  );

  // -------------------------------------------------------------------------
  // 8. Rider cash state + deposits (all 3 verification states)
  // -------------------------------------------------------------------------
  const tripByRider = new Map<string, number>();
  for (const t of await prisma.riderTripLedger.findMany()) {
    tripByRider.set(t.riderId, (tripByRider.get(t.riderId) ?? 0) + Number(t.codCollected));
  }
  const depositSeed = [
    { riderIndex: 1, amount: 1500, status: CashDepositStatus.APPROVED, ref: 'DEP-HUB-0001', note: 'Bank transfer verified' },
    { riderIndex: 3, amount: 900, status: CashDepositStatus.APPROVED, ref: 'DEP-HUB-0002', note: 'Cash deposited at Banani hub' },
    { riderIndex: 4, amount: 800, status: CashDepositStatus.PENDING_APPROVAL, ref: 'DEP-HUB-0003', note: 'Awaiting hub verification' },
    { riderIndex: 5, amount: 500, status: CashDepositStatus.REJECTED, ref: 'DEP-HUB-0004', note: 'Reference number mismatch with hub register' },
  ];
  const approvedDeposits = new Map<string, number>();
  for (const d of depositSeed) {
    const rider = approvedRiders[d.riderIndex];
    if (!rider) continue;
    await prisma.cashDeposit.create({
      data: {
        riderId: rider.id,
        amount: d.amount,
        status: d.status,
        referenceNo: d.ref,
        note: d.note,
        depositedAt: at(now, -randInt(1, 5) * DAY),
      },
    });
    if (d.status === CashDepositStatus.APPROVED) {
      approvedDeposits.set(rider.id, (approvedDeposits.get(rider.id) ?? 0) + d.amount);
    }
  }
  for (const [riderId, cash] of tripByRider) {
    await prisma.rider.update({
      where: { id: riderId },
      data: { cashInHand: round2(Math.max(0, cash - (approvedDeposits.get(riderId) ?? 0))) },
    });
  }
  // Near-limit demo rider: holdings parked just under the ৳5000 ceiling.
  const busiestRider = [...tripByRider.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiestRider) {
    await prisma.rider.update({ where: { id: busiestRider[0] }, data: { cashInHand: 4850 } });
  }

  // -------------------------------------------------------------------------
  // 9. Coupon usage counts reflect non-cancelled usage (rollback semantics)
  // -------------------------------------------------------------------------
  for (const [code, row] of couponRows) {
    const active = created.filter((o) => o.couponCode === code && o.status !== OrderStatus.CANCELLED).length;
    await prisma.coupon.update({
      where: { id: row.id },
      data: { currentUses: code === 'FIRSTX2' ? Math.max(active, 2) : active },
    });
  }

  // -------------------------------------------------------------------------
  // 10. Reconciliation asserts — a broken seed fails loudly
  // -------------------------------------------------------------------------
  console.log('\n🔍 Reconciling seeded books...');
  const ordersAll = await prisma.order.findMany({ include: { commission: true, riderTrip: true } });
  for (const o of ordersAll) {
    if (o.status === OrderStatus.CANCELLED) {
      if (o.commission || o.riderTrip) fail(`cancelled order ${o.orderNumber} must have no ledgers`);
    } else if (!o.commission) {
      fail(`live/delivered order ${o.orderNumber} missing commission ledger`);
    }
    if (o.status === OrderStatus.DELIVERED && !o.riderTrip) {
      fail(`delivered order ${o.orderNumber} missing rider trip ledger`);
    }
    if (o.paymentMethod === PaymentMethod.ONLINE_GATEWAY && o.status !== OrderStatus.CANCELLED && o.paymentStatus !== PaymentStatus.PAID) {
      fail(`online order ${o.orderNumber} must be PAID to remain in dispatch`);
    }
    if (o.status === OrderStatus.PLACED && o.orderFlowMode !== OrderFlowMode.RIDER_FIRST) {
      fail(`PLACED order ${o.orderNumber} must belong to a RIDER_FIRST outlet (claimable)`);
    }
  }
  const ledgerTotals = await prisma.commissionLedger.aggregate({
    _sum: { grossAmount: true, commissionAmount: true, netVendorPayable: true },
  });
  const sumGross = Number(ledgerTotals._sum.grossAmount ?? 0);
  const sumCommission = Number(ledgerTotals._sum.commissionAmount ?? 0);
  const sumPayable = Number(ledgerTotals._sum.netVendorPayable ?? 0);
  if (Math.abs(sumCommission + sumPayable - sumGross) > 0.05) {
    fail(`commission math drift: ${sumCommission} + ${sumPayable} != ${sumGross}`);
  }
  const tripEarnings = await prisma.riderTripLedger.aggregate({ _sum: { deliveryEarnings: true } });
  const deliveredCount = ordersAll.filter((o) => o.status === OrderStatus.DELIVERED).length;
  const expectedEarnings = round2(deliveredCount * 50 * 0.8);
  if (Math.abs(Number(tripEarnings._sum.deliveryEarnings ?? 0) - expectedEarnings) > 0.05) {
    fail(`rider earnings mismatch: expected ${expectedEarnings} for ${deliveredCount} deliveries`);
  }

  // -------------------------------------------------------------------------
  // 11. Summary
  // -------------------------------------------------------------------------
  const customerCount = await prisma.user.count({ where: { role: UserRole.CUSTOMER } });
  const gmv = round2(ordersAll
    .filter((o) => o.status === OrderStatus.DELIVERED)
    .reduce((s, o) => s + Number(o.totalAmount), 0));

  console.log(`
============================================================
🎉 DeliveryOS production-realistic seed complete!
============================================================
👥 Users: ${await prisma.user.count()} (${customerCount} customers incl. 1 suspended, ${await prisma.rider.count()} riders incl. 2 applicants)
🏬 Outlets: ${await prisma.vendor.count()} across ${OUTLET_TYPES.length} types (Cafe hidden) · 📦 Products: ${await prisma.product.count()} (+${await prisma.productVariant.count()} variants)
🖼️  Banners: ${await prisma.banner.count()} · 🎟️  Coupons: ${await prisma.coupon.count()}
📦 Orders: ${ordersAll.length} (${deliveredCount} delivered, ${ordersAll.filter((o) => o.status === OrderStatus.CANCELLED).length} cancelled, ${ordersAll.length - deliveredCount - ordersAll.filter((o) => o.status === OrderStatus.CANCELLED).length} live)
💰 GMV (delivered): ৳${gmv} · Commission: ৳${round2(sumCommission)} · Vendor payable: ৳${round2(sumPayable)} · Rider earnings: ৳${Number(tripEarnings._sum.deliveryEarnings ?? 0)}
🧾 Ledgers: ${await prisma.commissionLedger.count()} commission / ${await prisma.riderTripLedger.count()} trips · Payments: ${await prisma.payment.count()} · Batches: ${await prisma.settlementBatch.count()} · Deposits: ${await prisma.cashDeposit.count()}
🗂️  Media assets: ${await prisma.mediaAsset.count()}

🔑 Demo logins (${OTP_LOGIN_NOTE}):
   Super Admin   +8801700000001
   Outlet Mgr    +8801700000002 (Burger Point Gulshan)
   Brand Owner   +8801700000003 (Burger Point, all outlets)
   Rider         +8801700000004 (online, active)
   Customer      +8801700000005
   Applicant     +8801700000042 (fleet approval queue demo)
   Suspended     +8801700000073 (suspension flow demo)
============================================================
`);
}
