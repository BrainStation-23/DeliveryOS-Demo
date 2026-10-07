/**
 * DeliveryOS — canonical production-realistic seed (full system reset).
 *
 * Running this script RESETS the whole database: every table is wiped in
 * FK-safe order, then the complete demo operation is rebuilt from scratch —
 * no leftovers from previous runs survive.
 *
 * Coverage: all 4 system settings, 5 outlet types (Cafe deactivated with
 * assigned outlets → ADR-019 customer-hiding demo), 9 real Dhaka brands /
 * 18 outlets with mixed flow modes, 2-tier vendor staff, ~120 products each
 * carrying ≥1 variation (ADR-017; out-of-stock + inactive-category cases are
 * seeded as display-only and never ordered), all banner link types
 * and schedule states, 9 coupon cases, ~450 orders across 30 days with
 * realistic weekend/diurnal timing, every cancellation actor × stage ×
 * payment outcome using the exact service reason formats, takeaway orders,
 * paired financial ledgers, SETTLED + PROCESSING settlement batches, cash
 * deposits in all 3 verification states, gateway payment rows, media library,
 * and the Redis runtime state (order-number counters, rider GEO index,
 * telemetry, busy markers, live order locations) so dispatch demos work
 * immediately after seeding.
 *
 * Deterministic: a fixed-seed LCG makes every run produce identical data.
 */
import * as dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config({ path: '../../.env' });
dotenv.config();

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
const RIDER_SHARE = 0.8; // delivery_economics.rider_share_percent: 80
const FLAT_DELIVERY_FEE = 50.0; // delivery_fee_config: FIXED_FLAT 50
const REDIS_FALLBACK_URL = 'redis://:redispassword@localhost:6380';

// ---------------------------------------------------------------------------
// Deterministic PRNG (LCG) + helpers
// ---------------------------------------------------------------------------
let randState = 20261006;
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
function hex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += '0123456789abcdef'[randInt(0, 15)];
  return s;
}
function fcmToken(): string {
  return `${hex(11)}:${hex(140)}`;
}
function fail(message: string): never {
  console.error(`\n❌ SEED RECONCILIATION FAILURE: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Geography: Dhaka service zones shared by outlets, riders and customers
// ---------------------------------------------------------------------------
type Zone = 'gulshan' | 'dhanmondi' | 'uttara' | 'mirpur' | 'bashundhara';
interface ZoneSpec {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  streets: string[];
}
const ZONES: Record<Zone, ZoneSpec> = {
  gulshan: {
    latMin: 23.786, latMax: 23.799, lngMin: 90.401, lngMax: 90.414,
    streets: [
      'House 12, Road 11, Banani, Dhaka',
      'Plot 5, Block C, Niketon, Gulshan, Dhaka',
      'Apartment 4B, Road 41, Gulshan 2, Dhaka',
      'House 34, Road 11, Banani DOHS, Dhaka',
      'Level 6, Gulshan Tower, Road 53, Gulshan 2, Dhaka',
      'House 8, Road 18, Block J, Baridhara, Dhaka',
    ],
  },
  dhanmondi: {
    latMin: 23.743, latMax: 23.753, lngMin: 90.369, lngMax: 90.381,
    streets: [
      'House 34, Road 27, Dhanmondi, Dhaka',
      'Apartment 9A, Road 5A, Dhanmondi, Dhaka',
      'House 7, Road 8, Dhanmondi, Dhaka',
      'Rahim Mansion, Road 12, Dhanmondi, Dhaka',
    ],
  },
  uttara: {
    latMin: 23.867, latMax: 23.883, lngMin: 90.373, lngMax: 90.389,
    streets: [
      'House 21, Road 7, Sector 4, Uttara, Dhaka',
      'Apartment 3C, Road 14, Sector 7, Uttara, Dhaka',
      'House 8, Road 2, Sector 11, Uttara, Dhaka',
    ],
  },
  mirpur: {
    latMin: 23.798, latMax: 23.813, lngMin: 90.361, lngMax: 90.373,
    streets: [
      'Plot 14, Block B, Mirpur 10, Dhaka',
      'House 3, Road 4, Block C, Mirpur 11, Dhaka',
      'Apartment 5B, Kazipara, Mirpur 10, Dhaka',
    ],
  },
  bashundhara: {
    latMin: 23.815, latMax: 23.827, lngMin: 90.429, lngMax: 90.443,
    streets: [
      'Plot 42, Block C, Bashundhara R/A, Dhaka',
      'House 9, Road 5, Block D, Bashundhara R/A, Dhaka',
      'Apartment 7A, Block B, Bashundhara R/A, Dhaka',
    ],
  },
};
function zoneCoord(zone: Zone): { lat: number; lng: number } {
  const z = ZONES[zone];
  return {
    lat: round2(z.latMin + rand() * (z.latMax - z.latMin)),
    lng: round2(z.lngMin + rand() * (z.lngMax - z.lngMin)),
  };
}

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------
const OUTLET_TYPES = [
  { name: 'Restaurant', slug: 'restaurant', sortOrder: 0, isActive: true },
  { name: 'Super Shop', slug: 'super-shop', sortOrder: 1, isActive: true },
  { name: 'Grocery', slug: 'grocery', sortOrder: 2, isActive: true },
  { name: 'Pharmacy', slug: 'pharmacy', sortOrder: 3, isActive: true },
  // Deactivated business type: its outlets stay administrable but are hidden
  // from customer discovery (ADR-019 soft control demo).
  { name: 'Cafe', slug: 'cafe', sortOrder: 4, isActive: false },
];

const BRANDS = [
  { name: 'Burger King', logo: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200' },
  { name: 'KFC', logo: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200' },
  { name: 'Pizza Hut', logo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200' },
  { name: "Sultan's Dine", logo: 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=200' },
  { name: 'Shwapno', logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200' },
  { name: 'Meena Bazar', logo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200' },
  { name: 'Khaas Food', logo: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=200' },
  { name: 'Lazz Pharma', logo: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200' },
  { name: 'North End Coffee Roasters', logo: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200' },
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
  inactive?: boolean;
}

const BK_CATS: CategorySpec[] = [
  {
    name: 'Flame-Grilled Burgers',
    products: [
      {
        name: 'Whopper',
        price: 420,
        desc: 'Flame-grilled beef, tomatoes, lettuce, mayo, pickles, soft bun',
        variants: [
          { name: 'Single', price: 420 },
          { name: 'Double', price: 620 },
        ],
      },
      {
        name: 'Chicken Royale',
        price: 380,
        desc: 'Crispy chicken fillet, lettuce, creamy royal sauce',
        variants: [
          { name: 'Single', price: 380 },
          { name: 'Double', price: 540 },
        ],
      },
      { name: 'Bacon King', price: 560, desc: 'Two beef patties, smoked bacon, melted cheddar' },
      { name: 'Tendercrisp Burger', price: 410, desc: 'Whole-muscle crispy chicken, fresh veggies' },
    ],
  },
  {
    name: 'Sides & Fries',
    products: [
      { name: 'King Fries (Regular)', price: 140 },
      { name: 'King Fries (Large)', price: 180 },
      { name: 'Onion Rings (8 pcs)', price: 160, outOfStock: true },
      { name: 'Chicken Nuggets (6 pcs)', price: 220 },
    ],
  },
  {
    name: 'Drinks & Shakes',
    products: [
      { name: 'Coca-Cola (330ml)', price: 45, unit: 'can' },
      { name: 'Chocolate Shake', price: 180 },
      { name: 'Mango Shake', price: 170 },
    ],
  },
  {
    // Hidden-from-catalog category (admin-only visibility demo).
    name: 'Limited Time Offers',
    inactive: true,
    products: [{ name: 'Whopper Wednesday Combo', price: 490, desc: 'Whopper + fries + coke bundle' }],
  },
];

const KFC_CATS: CategorySpec[] = [
  {
    name: 'Buckets & Boxes',
    products: [
      {
        name: 'Hot & Crispy Chicken',
        price: 1250,
        desc: 'Signature pressure-fried chicken',
        variants: [
          { name: '8 pcs', price: 1250 },
          { name: '12 pcs', price: 1750 },
          { name: '15 pcs Festival Bucket', price: 2150, outOfStock: true },
        ],
      },
      { name: 'Chicken & Fries Box', price: 590 },
      { name: 'Rice Box with Gravy', price: 350 },
    ],
  },
  {
    name: 'Burgers & Wraps',
    products: [
      { name: 'Zinger Burger', price: 350, desc: 'Spicy crispy fillet, lettuce, mayo' },
      { name: 'Zinger Stacker', price: 520 },
      { name: 'Chicken Cheese Wrap', price: 290 },
    ],
  },
  {
    name: 'Snacks & Drinks',
    products: [
      { name: 'Popcorn Chicken (Regular)', price: 180 },
      { name: 'Hot Wings (5 pcs)', price: 200, outOfStock: true },
      { name: 'Pepsi (345ml)', price: 45, unit: 'can' },
      { name: 'Mountain Dew (345ml)', price: 45, unit: 'can' },
    ],
  },
];

const PIZZA_CATS: CategorySpec[] = [
  {
    name: 'Signature Pizzas',
    products: [
      {
        name: 'Chicken Supreme',
        price: 390,
        desc: 'Chicken tikka, onion, capsicum, mushroom',
        variants: [
          { name: 'Personal', price: 390 },
          { name: 'Medium', price: 890 },
          { name: 'Large', price: 1190 },
        ],
      },
      {
        name: 'Pepperoni Plus',
        price: 420,
        desc: 'Double beef pepperoni, extra mozzarella',
        variants: [
          { name: 'Personal', price: 420 },
          { name: 'Medium', price: 950 },
          { name: 'Large', price: 1250 },
        ],
      },
      {
        name: 'Margherita',
        price: 350,
        variants: [
          { name: 'Personal', price: 350 },
          { name: 'Medium', price: 750 },
        ],
      },
    ],
  },
  {
    name: 'Sides & Pasta',
    products: [
      { name: 'Garlic Breadstick (6 pcs)', price: 180 },
      { name: 'Chicken Wings (6 pcs)', price: 260 },
      { name: 'Creamy Chicken Pasta', price: 420 },
    ],
  },
  {
    name: 'Drinks & Desserts',
    products: [
      { name: 'Pepsi (445ml)', price: 60, unit: 'bottle' },
      { name: 'Chocolate Lava Cake', price: 160 },
    ],
  },
];

const SULTANS_CATS: CategorySpec[] = [
  {
    name: 'Kacchi & Biryani',
    products: [
      {
        name: 'Kacchi Biryani',
        price: 340,
        desc: 'Aged basmati, marinated mutton, aloo, borhani',
        variants: [
          { name: 'Single', price: 340 },
          { name: 'Family Pack (4)', price: 1250 },
        ],
      },
      { name: 'Chicken Biryani', price: 280 },
      { name: 'Beef Tehari', price: 250 },
      { name: 'Mutton Chaap', price: 320 },
    ],
  },
  {
    name: 'Sides & Sweets',
    products: [
      { name: 'Seekh Kebab (4 pcs)', price: 240 },
      { name: 'Borhani (Glass)', price: 80 },
      { name: 'Firni (Bowl)', price: 90 },
    ],
  },
];

const SHWAPNO_CATS: CategorySpec[] = [
  {
    name: 'Fresh Farm Produce',
    products: [
      { name: 'Bananas', price: 90, unit: 'dozen' },
      { name: 'Red Tomatoes', price: 65, unit: 'kg' },
      { name: 'Spinach Bundle', price: 40, unit: 'bundle' },
      { name: 'Potatoes', price: 45, unit: 'kg' },
    ],
  },
  {
    name: 'Dairy & Eggs',
    products: [
      { name: 'Farm Eggs', price: 130, unit: 'dozen' },
      { name: 'Full Cream Milk 1L', price: 95, unit: 'litre' },
      { name: 'Butter 200g', price: 260 },
    ],
  },
  {
    name: 'Pantry Staples',
    products: [
      { name: 'Basmati Rice 5kg', price: 620, unit: 'bag' },
      { name: 'Mustard Oil 1L', price: 190, unit: 'litre' },
      { name: 'Sugar 2kg', price: 165, unit: 'bag' },
      { name: 'Atta Flour 2kg', price: 135, unit: 'bag' },
    ],
  },
  {
    name: 'Beverages',
    products: [
      { name: 'Coca-Cola 1.25L', price: 90, unit: 'bottle' },
      { name: 'Mineral Water 1L', price: 20, unit: 'bottle' },
      { name: 'Tea Leaves 400g', price: 210 },
    ],
  },
  {
    name: 'Household Essentials',
    products: [
      { name: 'Dishwashing Liquid 500ml', price: 110 },
      { name: 'Laundry Detergent 1kg', price: 210 },
      { name: 'Tissue Box (200 pulls)', price: 85, outOfStock: true },
    ],
  },
];

const MEENA_CATS: CategorySpec[] = [
  {
    name: 'Fresh & Chilled',
    products: [
      { name: 'Hilsa Fish (Large)', price: 850, unit: 'piece' },
      { name: 'Broiler Chicken (Whole)', price: 260, unit: 'kg' },
      { name: 'Green Chillies', price: 30, unit: '100g' },
    ],
  },
  {
    name: 'Grocery Corner',
    products: [
      { name: 'Nazirshail Rice 5kg', price: 480, unit: 'bag' },
      { name: 'Soybean Oil 5L', price: 850, unit: 'jar' },
      { name: 'Red Lentil 1kg', price: 120, unit: 'kg' },
    ],
  },
  {
    name: 'Bakery & Snacks',
    products: [
      { name: 'Sandwich Bread (Loaf)', price: 55 },
      { name: 'Butter Cookies 300g', price: 190 },
    ],
  },
];

const KHAAS_CATS: CategorySpec[] = [
  {
    name: 'Premium Grocery',
    products: [
      { name: 'Khaas Chinigura Rice 5kg', price: 720, unit: 'bag', desc: 'Aromatic premium chinigura' },
      { name: 'Khaas Mustard Oil 1L', price: 240, unit: 'litre', desc: 'Cold-pressed, ghani extracted' },
      { name: 'Sundarban Honey 500g', price: 520 },
      { name: 'Turmeric Powder 200g', price: 95 },
    ],
  },
  {
    name: 'Farm Dairy',
    products: [
      { name: 'Ghee 500ml', price: 690 },
      { name: 'Curd (Doi) 500g', price: 120 },
      { name: 'Farm Eggs (Half Dozen)', price: 70, unit: 'half-dozen' },
    ],
  },
  {
    name: 'Bakery Bites',
    products: [
      { name: 'Date Cake (500g)', price: 320 },
      { name: 'Bakarkhani (4 pcs)', price: 60 },
    ],
  },
];

const LAZZ_CATS: CategorySpec[] = [
  {
    name: 'Wellness Essentials',
    products: [
      { name: 'Paracetamol 500mg', price: 30, unit: 'strip' },
      { name: 'Vitamin C 1000mg (10s)', price: 110 },
      { name: 'ORS Saline', price: 8, unit: 'pack' },
      { name: 'Antacid Syrup 100ml', price: 55 },
    ],
  },
  {
    name: 'Baby & Mother Care',
    products: [
      { name: 'Baby Diapers (M, 42s)', price: 480, outOfStock: true },
      { name: 'Baby Lotion 200ml', price: 260 },
      { name: 'Maternity Multivitamin (30s)', price: 350 },
    ],
  },
  {
    name: 'Personal Care',
    products: [
      { name: 'Hand Sanitizer 250ml', price: 140 },
      { name: 'Digital Thermometer', price: 250 },
      { name: 'Face Mask (Box of 50)', price: 120 },
    ],
  },
];

const NORTH_END_CATS: CategorySpec[] = [
  {
    name: 'Coffee Bar',
    products: [
      {
        name: 'Cappuccino',
        price: 280,
        desc: 'Double shot espresso, steamed milk, dense foam',
        variants: [
          { name: 'Regular', price: 280 },
          { name: 'Large', price: 330 },
        ],
      },
      { name: 'Americano', price: 220 },
      { name: 'Iced Latte', price: 320 },
      { name: 'Cold Brew (16oz)', price: 350 },
    ],
  },
  {
    name: 'Bakery & Bites',
    products: [
      { name: 'Chocolate Fudge Cake (Slice)', price: 220 },
      { name: 'New York Cheesecake (Slice)', price: 260 },
      { name: 'Butter Croissant', price: 150 },
      { name: 'Chicken Quiche', price: 240, outOfStock: true },
    ],
  },
];

interface OutletSpec {
  name: string; // full pre-composed "Brand - Outlet" identity
  brand: string;
  typeSlug: string;
  zone: Zone;
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
  isBusy?: boolean;
  openTime?: string;
  closeTime?: string;
  closedDay?: number;
  categories: CategorySpec[];
}

const OUTLETS: OutletSpec[] = [
  {
    name: 'Gulshan', brand: 'Burger King', typeSlug: 'restaurant', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000001', lat: 23.7925, lng: 90.4078,
    address: 'Plot 15, Block CWN(A), Kamal Ataturk Ave, Gulshan 2, Dhaka',
    commission: 15, radius: 5, prep: 15,
    banner: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
    categories: BK_CATS,
  },
  {
    name: 'Dhanmondi', brand: 'Burger King', typeSlug: 'restaurant', zone: 'dhanmondi',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000002', lat: 23.7461, lng: 90.3742,
    address: 'Road 27, Dhanmondi, Dhaka', commission: 15, radius: 4.5, prep: 18,
    categories: [BK_CATS[0], BK_CATS[2]],
  },
  {
    // Per-outlet swap: a restaurant running traditional vendor-first flow.
    name: 'Uttara', brand: 'Burger King', typeSlug: 'restaurant', zone: 'uttara',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000012', lat: 23.8759, lng: 90.3795,
    address: 'Sector 4, Road 7, Uttara, Dhaka', commission: 15, radius: 5, prep: 15,
    categories: [BK_CATS[0], BK_CATS[1]],
  },
  {
    name: 'Banani', brand: 'KFC', typeSlug: 'restaurant', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000003', lat: 23.7936, lng: 90.4043,
    address: 'Road 11, Banani, Dhaka', commission: 15, radius: 5, prep: 18,
    openTime: '10:00:00', closeTime: '23:30:00',
    banner: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    categories: KFC_CATS,
  },
  {
    name: 'Mirpur', brand: 'KFC', typeSlug: 'restaurant', zone: 'mirpur',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000013', lat: 23.8042, lng: 90.3687,
    address: 'Mirpur 10 Circle, Dhaka', commission: 15, radius: 5, prep: 18,
    categories: [KFC_CATS[0], KFC_CATS[2]],
  },
  {
    name: 'Gulshan', brand: 'Pizza Hut', typeSlug: 'restaurant', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000004', lat: 23.7906, lng: 90.4045,
    address: 'Gulshan 1, Dhaka', commission: 15, radius: 5, prep: 25,
    banner: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    categories: PIZZA_CATS,
  },
  {
    name: 'Bashundhara', brand: 'Pizza Hut', typeSlug: 'restaurant', zone: 'bashundhara',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000014', lat: 23.8208, lng: 90.4359,
    address: 'Block C, Bashundhara R/A, Dhaka', commission: 15, radius: 4.5, prep: 25,
    categories: PIZZA_CATS,
  },
  {
    name: "Banani", brand: "Sultan's Dine", typeSlug: 'restaurant', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000005', lat: 23.7941, lng: 90.4025,
    address: 'Road 12, Banani, Dhaka', commission: 18, radius: 5, prep: 30,
    banner: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800',
    categories: SULTANS_CATS,
  },
  {
    // Suspended outlet + weekly Friday closed day.
    name: "Dhanmondi", brand: "Sultan's Dine", typeSlug: 'restaurant', zone: 'dhanmondi',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000015', lat: 23.7491, lng: 90.3771,
    address: 'Road 5, Dhanmondi, Dhaka', commission: 18, radius: 4, prep: 30,
    isActive: false, closedDay: 5,
    categories: SULTANS_CATS,
  },
  {
    name: 'Gulshan', brand: 'Shwapno', typeSlug: 'super-shop', zone: 'gulshan',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000006', lat: 23.7916, lng: 90.4098,
    address: 'Gulshan 1 DCC Market, Dhaka', commission: 10, radius: 6, prep: 20,
    categories: SHWAPNO_CATS,
  },
  {
    name: 'Uttara', brand: 'Shwapno', typeSlug: 'super-shop', zone: 'uttara',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000016', lat: 23.8788, lng: 90.3826,
    address: 'Sector 7, Uttara, Dhaka', commission: 10, radius: 6, prep: 20,
    categories: [SHWAPNO_CATS[0], SHWAPNO_CATS[1], SHWAPNO_CATS[2]],
  },
  {
    // Busy-paused outlet: temporarily not accepting new orders.
    name: 'Dhanmondi', brand: 'Meena Bazar', typeSlug: 'super-shop', zone: 'dhanmondi',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000017', lat: 23.747, lng: 90.3755,
    address: 'Road 8, Dhanmondi, Dhaka', commission: 10, radius: 5, prep: 20, isBusy: true,
    categories: MEENA_CATS,
  },
  {
    // Grocery outlet deliberately running rider-first flow.
    name: 'Banani', brand: 'Khaas Food', typeSlug: 'grocery', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000007', lat: 23.795, lng: 90.401,
    address: 'Road 11, Banani, Dhaka', commission: 12, radius: 4, prep: 25,
    categories: KHAAS_CATS,
  },
  {
    name: 'Mirpur', brand: 'Khaas Food', typeSlug: 'grocery', zone: 'mirpur',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000018', lat: 23.81, lng: 90.3659,
    address: 'Block B, Mirpur 10, Dhaka', commission: 12, radius: 4, prep: 25, closedDay: 5,
    categories: KHAAS_CATS,
  },
  {
    // 24/7 pharmacy: always-open operating schedule case.
    name: 'Gulshan', brand: 'Lazz Pharma', typeSlug: 'pharmacy', zone: 'gulshan',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000008', lat: 23.7908, lng: 90.4092,
    address: 'Gulshan 2 Circle, Dhaka', commission: 8, radius: 6, prep: 10,
    openTime: '00:00:00', closeTime: '23:59:00',
    categories: LAZZ_CATS,
  },
  {
    name: 'Uttara', brand: 'Lazz Pharma', typeSlug: 'pharmacy', zone: 'uttara',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000019', lat: 23.8765, lng: 90.38,
    address: 'Sector 6, Uttara, Dhaka', commission: 8, radius: 6, prep: 10,
    openTime: '08:00:00', closeTime: '23:00:00',
    categories: [LAZZ_CATS[0], LAZZ_CATS[1]],
  },
  {
    // Cafe type deactivated (ADR-019): outlets administrable, hidden from app.
    name: 'Banani', brand: 'North End Coffee Roasters', typeSlug: 'cafe', zone: 'gulshan',
    mode: OrderFlowMode.RIDER_FIRST, phone: '+8801711000009', lat: 23.7953, lng: 90.4007,
    address: 'Road 11, Banani, Dhaka', commission: 15, radius: 4, prep: 12,
    openTime: '08:00:00', closeTime: '22:00:00',
    categories: NORTH_END_CATS,
  },
  {
    name: 'Dhanmondi', brand: 'North End Coffee Roasters', typeSlug: 'cafe', zone: 'dhanmondi',
    mode: OrderFlowMode.VENDOR_FIRST, phone: '+8801711000010', lat: 23.7465, lng: 90.376,
    address: 'Road 9/A, Dhanmondi, Dhaka', commission: 15, radius: 4, prep: 12,
    openTime: '08:00:00', closeTime: '22:00:00',
    categories: NORTH_END_CATS,
  },
];

// Per-outlet order popularity weight keyed by "Brand - Outlet" (production GMV shape).
const OUTLET_POPULARITY: Record<string, number> = {
  'Burger King - Gulshan': 1.5,
  'Burger King - Dhanmondi': 1.2,
  'Burger King - Uttara': 1.1,
  'KFC - Banani': 1.4,
  'KFC - Mirpur': 1.0,
  'Pizza Hut - Gulshan': 1.2,
  'Pizza Hut - Bashundhara': 0.9,
  "Sultan's Dine - Banani": 1.3,
  "Sultan's Dine - Dhanmondi": 0.8,
  'Shwapno - Gulshan': 1.1,
  'Shwapno - Uttara': 0.9,
  'Meena Bazar - Dhanmondi': 0.7,
  'Khaas Food - Banani': 1.0,
  'Khaas Food - Mirpur': 0.7,
  'Lazz Pharma - Gulshan': 0.7,
  'Lazz Pharma - Uttara': 0.5,
  'North End Coffee - Banani': 0.6,
  'North End Coffee - Dhanmondi': 0.5,
};

// Diurnal order-hour pools per outlet type (BD lunch ~12–14, dinner ~19–22).
const HOUR_POOLS: Record<string, number[]> = {
  restaurant: [11, 12, 12, 13, 13, 13, 14, 14, 15, 16, 17, 18, 19, 19, 19, 20, 20, 20, 21, 21, 21, 22],
  'super-shop': [9, 10, 10, 11, 11, 12, 12, 13, 14, 15, 15, 16, 17, 18, 19, 20, 20, 21],
  grocery: [9, 10, 10, 11, 11, 12, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 21],
  pharmacy: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  cafe: [8, 9, 9, 10, 10, 11, 12, 13, 15, 16, 17, 17, 18, 19, 20, 21],
};

const RIDER_SEED: Array<{ phone: string; name: string; vehicle: string; zone: Zone; online: boolean }> = [
  { phone: '+8801700000004', name: 'Tanvir Hasan', vehicle: 'motorcycle', zone: 'gulshan', online: true },
  { phone: '+8801700000030', name: 'Jashim Uddin', vehicle: 'motorcycle', zone: 'gulshan', online: true },
  { phone: '+8801700000031', name: 'Farhan Akash', vehicle: 'motorcycle', zone: 'gulshan', online: true },
  { phone: '+8801700000032', name: 'Sohel Rana', vehicle: 'motorcycle', zone: 'dhanmondi', online: true },
  { phone: '+8801700000033', name: 'Mizanur Rahman', vehicle: 'motorcycle', zone: 'uttara', online: true },
  { phone: '+8801700000034', name: 'Rakib Hossain', vehicle: 'motorcycle', zone: 'mirpur', online: true },
  { phone: '+8801700000035', name: 'Nasir Islam', vehicle: 'bicycle', zone: 'gulshan', online: true },
  { phone: '+8801700000036', name: 'Arif Chowdhury', vehicle: 'motorcycle', zone: 'dhanmondi', online: true },
  { phone: '+8801700000037', name: 'Dipu Mondol', vehicle: 'motorcycle', zone: 'gulshan', online: true },
  { phone: '+8801700000038', name: 'Kamal Hossain', vehicle: 'motorcycle', zone: 'gulshan', online: true },
  { phone: '+8801700000039', name: 'Shahin Alam', vehicle: 'motorcycle', zone: 'bashundhara', online: false },
  { phone: '+8801700000040', name: 'Rasel Mia', vehicle: 'motorcycle', zone: 'uttara', online: false },
  { phone: '+8801700000041', name: 'Titu Roy', vehicle: 'bicycle', zone: 'dhanmondi', online: false },
  { phone: '+8801700000044', name: 'Abdur Karim', vehicle: 'motorcycle', zone: 'mirpur', online: false },
  { phone: '+8801700000045', name: 'Milon Sheikh', vehicle: 'motorcycle', zone: 'gulshan', online: false },
  { phone: '+8801700000046', name: 'Ibrahim Khalil', vehicle: 'motorcycle', zone: 'uttara', online: false },
  { phone: '+8801700000047', name: 'Sumon Barua', vehicle: 'motorcycle', zone: 'dhanmondi', online: false },
  { phone: '+8801700000048', name: 'Anisur Rahman', vehicle: 'motorcycle', zone: 'mirpur', online: false },
  { phone: '+8801700000049', name: 'Palash Ahmed', vehicle: 'motorcycle', zone: 'gulshan', online: false },
  { phone: '+8801700000069', name: 'Habibur Rahman', vehicle: 'motorcycle', zone: 'gulshan', online: false },
  // Fleet approval queue applicants.
  { phone: '+8801700000042', name: 'Ashiq Mahmud', vehicle: 'motorcycle', zone: 'gulshan', online: false },
  { phone: '+8801700000043', name: 'Sajal Ganguly', vehicle: 'motorcycle', zone: 'dhanmondi', online: false },
];

const CUSTOMER_SEED: Array<{ phone: string; name: string; zone: Zone; secondZone?: Zone }> = [
  { phone: '+8801700000005', name: 'Rahim Uddin', zone: 'gulshan', secondZone: 'dhanmondi' },
  { phone: '+8801700000050', name: 'Nusrat Jahan', zone: 'gulshan' },
  { phone: '+8801700000051', name: 'Sabbir Ahmed', zone: 'gulshan' },
  { phone: '+8801700000052', name: 'Mitu Karim', zone: 'gulshan' },
  { phone: '+8801700000053', name: 'Rownak Jahan', zone: 'gulshan', secondZone: 'uttara' },
  { phone: '+8801700000054', name: 'Tanvir Ahmed', zone: 'gulshan' },
  { phone: '+8801700000055', name: 'Shapla Begum', zone: 'gulshan' },
  { phone: '+8801700000056', name: 'Ridoy Hasan', zone: 'gulshan' },
  { phone: '+8801700000057', name: 'Farzana Akter', zone: 'gulshan' },
  { phone: '+8801700000058', name: 'Mahin Sarkar', zone: 'gulshan' },
  { phone: '+8801700000059', name: 'Sumaiya Islam', zone: 'gulshan' },
  { phone: '+8801700000060', name: 'Rakibul Hasan', zone: 'dhanmondi' },
  { phone: '+8801700000061', name: 'Nadia Kabir', zone: 'dhanmondi', secondZone: 'gulshan' },
  { phone: '+8801700000062', name: 'Imran Hossain', zone: 'dhanmondi' },
  { phone: '+8801700000063', name: 'Tasnim Rahman', zone: 'dhanmondi' },
  { phone: '+8801700000064', name: 'Zahid Hasan', zone: 'dhanmondi' },
  { phone: '+8801700000065', name: 'Mim Akter', zone: 'dhanmondi' },
  { phone: '+8801700000066', name: 'Sajid Khan', zone: 'uttara' },
  { phone: '+8801700000067', name: 'Rehana Parvin', zone: 'uttara' },
  { phone: '+8801700000068', name: 'Ovi Chowdhury', zone: 'uttara', secondZone: 'gulshan' },
  { phone: '+8801700000074', name: 'Shahida Islam', zone: 'uttara' },
  { phone: '+8801700000075', name: 'Kamrul Hasan', zone: 'mirpur' },
  { phone: '+8801700000076', name: 'Nila Sarker', zone: 'mirpur' },
  { phone: '+8801700000077', name: 'Rana Miah', zone: 'mirpur' },
  { phone: '+8801700000078', name: 'Sultana Raju', zone: 'mirpur', secondZone: 'uttara' },
  { phone: '+8801700000079', name: 'Fahim Reza', zone: 'bashundhara' },
  { phone: '+8801700000080', name: 'Ishrat Jahan', zone: 'bashundhara' },
  { phone: '+8801700000081', name: 'Nafis Ahmed', zone: 'bashundhara', secondZone: 'gulshan' },
  { phone: '+8801700000082', name: 'Rumana Haque', zone: 'gulshan' },
  { phone: '+8801700000083', name: 'Tofazzal Hossain', zone: 'gulshan' },
  { phone: '+8801700000084', name: 'Sharmin Sultana', zone: 'dhanmondi' },
  { phone: '+8801700000085', name: 'Asaduzzaman Noor', zone: 'gulshan' },
  { phone: '+8801700000086', name: 'Priyanka Dey', zone: 'gulshan' },
  { phone: '+8801700000087', name: 'Mehedi Hasan', zone: 'dhanmondi' },
  { phone: '+8801700000088', name: 'Ayesha Siddiqua', zone: 'uttara' },
  { phone: '+8801700000089', name: 'Golam Rabbani', zone: 'mirpur' },
  { phone: '+8801700000090', name: 'Sanjida Chowdhury', zone: 'gulshan' },
  { phone: '+8801700000091', name: 'Rifat Mahmud', zone: 'gulshan' },
  { phone: '+8801700000092', name: 'Lamia Rahman', zone: 'dhanmondi' },
  { phone: '+8801700000093', name: 'Junaid Alam', zone: 'uttara' },
  { phone: '+8801700000094', name: 'Shefali Roy', zone: 'gulshan' },
];

const CUSTOMER_NOTES = [
  'Please ring the bell twice.',
  'Leave the parcel with the security guard at the gate.',
  'Call me when you reach the main road.',
  'Extra ketchup and mayo please.',
  'The apartment lift is out of service — 3rd floor by stairs.',
  'Please avoid calling after 9 PM, text instead.',
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
  console.log('🌱 DeliveryOS production-realistic seeder (full reset) starting...\n');

  // -------------------------------------------------------------------------
  // 0. Full system reset — wipe every table in FK-safe order
  // -------------------------------------------------------------------------
  await prisma.payment.deleteMany({});
  await prisma.commissionLedger.deleteMany({});
  await prisma.riderTripLedger.deleteMany({});
  await prisma.settlementBatch.deleteMany({});
  await prisma.cashDeposit.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customerAddress.deleteMany({});
  await prisma.vendorStaff.deleteMany({});
  await prisma.vendorOperatingHour.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.banner.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.rider.deleteMany({});
  await prisma.mediaAsset.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.vendorBrand.deleteMany({});
  await prisma.outletType.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('🧹 Database fully wiped (all 22 tables).');

  // -------------------------------------------------------------------------
  // 1. System settings (all four keys, exact payload shapes the services read)
  // -------------------------------------------------------------------------
  console.log('⚙️  Seeding system settings...');
  await prisma.systemSetting.create({
    data: {
      key: 'dispatch_config',
      value: { rider_search_timeout_seconds: 90, stale_order_ttl_minutes: 60 },
      description: 'Dispatch timing (rider search timeout, stale-order TTL)',
    },
  });
  await prisma.systemSetting.create({
    data: {
      key: 'delivery_fee_config',
      value: { mode: 'FIXED_FLAT', flatFee: 50.0, baseFee: 30.0, baseKm: 2.0, perKmRate: 10.0 },
      description: 'Delivery fee pricing mode: FIXED_FLAT vs DISTANCE_TIERED',
    },
  });
  await prisma.systemSetting.create({
    data: {
      key: 'delivery_economics',
      value: { rider_share_percent: 80, eta_avg_speed_kmh: 25, eta_fallback_minutes: 10 },
      description: 'Rider payout share and ETA assumptions',
    },
  });
  await prisma.systemSetting.create({
    data: {
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
    const row = await prisma.outletType.create({ data: t });
    typeBySlug.set(t.slug, row.id);
  }

  // -------------------------------------------------------------------------
  // 3. Brands, outlets, menus, operating schedules
  // -------------------------------------------------------------------------
  console.log('🏬 Seeding brands, outlets, menus, and schedules...');
  const brandByName = new Map<string, string>();
  for (const [i, b] of BRANDS.entries()) {
    const row = await prisma.vendorBrand.create({
      data: { name: b.name, logoUrl: b.logo, createdAt: at(now, -(400 + i * 37) * DAY) },
    });
    brandByName.set(b.name, row.id);
  }

  interface OutletCtx {
    id: string;
    spec: OutletSpec;
    products: Array<{
      id: string;
      name: string;
      price: number;
      isInStock: boolean;
      categoryActive: boolean;
      variants: Array<{ id: string; name: string; price: number; isInStock: boolean }>;
    }>;
  }
  const outletCtxs: OutletCtx[] = [];

  for (const [oi, spec] of OUTLETS.entries()) {
    const brandLogo = BRANDS.find((b) => b.name === spec.brand)?.logo ?? null;
    const outlet = await prisma.vendor.create({
      data: {
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
        isBusy: spec.isBusy ?? false,
        createdAt: at(now, -(560 - oi * 26) * DAY),
      },
    });
    const ctx: OutletCtx = { id: outlet.id, spec, products: [] };
    outletCtxs.push(ctx);

    for (const [ci, cat] of spec.categories.entries()) {
      const category = await prisma.category.create({
        data: {
          vendorId: outlet.id,
          name: cat.name,
          sortOrder: ci + 1,
          isActive: !cat.inactive,
        },
      });
      for (const [pi, p] of cat.products.entries()) {
        const product = await prisma.product.create({
          data: {
            vendorId: outlet.id,
            categoryId: category.id,
            name: p.name,
            description: p.desc ?? null,
            basePrice: p.price,
            unitType: p.unit ?? 'piece',
            imageUrl: spec.banner ?? brandLogo,
            isInStock: !p.outOfStock,
            sortOrder: pi + 1,
          },
        });
        const variationSpecs = p.variants?.length
          ? p.variants
          : [{ name: 'Regular', price: p.price, outOfStock: p.outOfStock }];
        const variants: Array<{ id: string; name: string; price: number; isInStock: boolean }> = [];
        for (const [vi, v] of variationSpecs.entries()) {
          const row = await prisma.productVariant.create({
            data: {
              productId: product.id,
              name: v.name,
              price: v.price,
              isInStock: !v.outOfStock,
              sortOrder: vi + 1,
            },
          });
          variants.push({ id: row.id, name: row.name, price: Number(row.price), isInStock: row.isInStock });
        }
        ctx.products.push({
          id: product.id,
          name: product.name,
          price: p.price,
          isInStock: !p.outOfStock,
          categoryActive: !cat.inactive,
          variants,
        });
      }
    }

    for (let d = 0; d <= 6; d++) {
      const closed = spec.closedDay === d;
      await prisma.vendorOperatingHour.create({
        data: {
          vendorId: outlet.id,
          dayOfWeek: d,
          openTime: closed ? '00:00:00' : spec.openTime ?? '10:00:00',
          closeTime: closed ? '00:00:00' : spec.closeTime ?? '22:00:00',
          isClosed: closed,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Users: super admin, vendor staff (both scopes), riders, customers
  // -------------------------------------------------------------------------
  console.log('👥 Seeding users...');
  const superAdmin = await prisma.user.create({
    data: {
      phone: '+8801700000001',
      fullName: 'Ashraf Rahman',
      email: 'ashraf.rahman@deliveryos.com',
      role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
      createdAt: at(now, -540 * DAY),
    },
  });

  const outletByKey = new Map(outletCtxs.map((o) => [`${o.spec.brand} - ${o.spec.name}`, o]));
  const staffSeed = [
    { phone: '+8801700000002', name: 'Rahim Chowdhury', email: 'rahim.chowdhury@gmail.com', scope: PermissionScope.PARTICULAR_OUTLET, outlet: 'Burger King - Gulshan' },
    { phone: '+8801700000003', name: 'Karim Chowdhury', email: 'karim.chowdhury@gmail.com', scope: PermissionScope.ALL_OUTLETS_MASTER, brand: 'Burger King' },
    { phone: '+8801700000020', name: 'Shirin Sultana', email: 'shirin.sultana@gmail.com', scope: PermissionScope.ALL_OUTLETS_MASTER, brand: 'Shwapno' },
    { phone: '+8801700000021', name: 'Nayan Mia', email: 'nayan.mia@gmail.com', scope: PermissionScope.PARTICULAR_OUTLET, outlet: 'Lazz Pharma - Gulshan' },
    { phone: '+8801700000022', name: 'Tanjina Akter', email: 'tanjina.akter@gmail.com', scope: PermissionScope.ALL_OUTLETS_MASTER, brand: 'KFC' },
    { phone: '+8801700000023', name: 'Sabbir Khan', email: 'sabbir.khan@gmail.com', scope: PermissionScope.PARTICULAR_OUTLET, outlet: "Sultan's Dine - Banani" },
    { phone: '+8801700000024', name: 'Mehrab Hossain', email: 'mehrab.hossain@gmail.com', scope: PermissionScope.ALL_OUTLETS_MASTER, brand: 'North End Coffee Roasters' },
  ];
  for (const [i, s] of staffSeed.entries()) {
    const user = await prisma.user.create({
      data: {
        phone: s.phone, fullName: s.name, email: s.email, role: UserRole.VENDOR_ADMIN,
        status: AccountStatus.ACTIVE, createdAt: at(now, -(300 - i * 11) * DAY),
      },
    });
    await prisma.vendorStaff.create({
      data: {
        userId: user.id,
        vendorId: s.outlet ? outletByKey.get(s.outlet)?.id ?? null : null,
        brandId: s.brand ? brandByName.get(s.brand) ?? null : null,
        scope: s.scope,
        isActive: true,
      },
    });
  }

  console.log('🛵 Seeding riders...');
  interface RiderCtx { id: string; userId: string; name: string; phone: string; approved: boolean; online: boolean; zone: Zone }
  const riderCtxs: RiderCtx[] = [];
  for (const [i, r] of RIDER_SEED.entries()) {
    const applicant = i >= RIDER_SEED.length - 2;
    const user = await prisma.user.create({
      data: {
        phone: r.phone,
        fullName: r.name,
        role: UserRole.RIDER,
        status: applicant ? AccountStatus.PENDING_APPROVAL : AccountStatus.ACTIVE,
        fcmToken: r.online ? fcmToken() : null,
        devicePlatform: r.online ? pick(['android', 'android', 'ios']) : null,
        createdAt: at(now, -(330 - i * 13) * DAY),
      },
    });
    const coords = zoneCoord(r.zone);
    const row = await prisma.rider.create({
      data: {
        userId: user.id,
        vehicleType: r.vehicle,
        isOnline: r.online && !applicant,
        isApproved: !applicant,
        cashInHand: 0,
        maxCashLimit: i === 0 ? 8000 : 5000,
        latitude: r.online && !applicant ? coords.lat : null,
        longitude: r.online && !applicant ? coords.lng : null,
      },
    });
    riderCtxs.push({
      id: row.id, userId: user.id, name: r.name, phone: r.phone,
      approved: !applicant, online: r.online && !applicant, zone: r.zone,
    });
  }
  const approvedRiders = riderCtxs.filter((r) => r.approved);

  console.log('🧑‍🤝‍🧑 Seeding customers...');
  interface CustomerCtx { id: string; phone: string; name: string; zone: Zone }
  interface AddressCtx {
    id: string;
    zone: Zone;
    label: string;
    addressLine: string;
    buildingFloor: string | null;
    deliveryNote: string | null;
    lat: number;
    lng: number;
  }
  const customerCtxs: CustomerCtx[] = [];
  const addressesByCustomer = new Map<string, AddressCtx[]>();
  for (const [i, c] of CUSTOMER_SEED.entries()) {
    const withPush = rand() < 0.35;
    const user = await prisma.user.create({
      data: {
        phone: c.phone,
        fullName: c.name,
        email: rand() < 0.4 ? `${c.phone.slice(-9)}@gmail.com` : null,
        role: UserRole.CUSTOMER,
        status: AccountStatus.ACTIVE,
        fcmToken: withPush ? fcmToken() : null,
        devicePlatform: withPush ? pick(['android', 'android', 'ios']) : null,
        createdAt: at(now, -(175 - i * 4) * DAY),
      },
    });
    customerCtxs.push({ id: user.id, phone: user.phone, name: c.name, zone: c.zone });

    const zones: Zone[] = c.secondZone ? [c.zone, c.secondZone] : [c.zone];
    const list: AddressCtx[] = [];
    for (const [zi, zone] of zones.entries()) {
      const coord = zoneCoord(zone);
      const data = {
        label: zones.length > 1 ? (zi === 0 ? 'Home' : 'Work') : pick(['Home', 'Home', 'Home', 'Work']),
        addressLine: pick(ZONES[zone].streets),
        buildingFloor: rand() < 0.5 ? `Level ${randInt(1, 7)}, House ${randInt(2, 62)}` : null,
        deliveryNote: rand() < 0.25 ? pick(CUSTOMER_NOTES) : null,
        latitude: coord.lat,
        longitude: coord.lng,
        isDefault: zi === 0,
      };
      const row = await prisma.customerAddress.create({ data: { userId: user.id, ...data } });
      list.push({
        id: row.id, zone, label: row.label, addressLine: row.addressLine,
        buildingFloor: row.buildingFloor, deliveryNote: row.deliveryNote,
        lat: row.latitude, lng: row.longitude,
      });
    }
    addressesByCustomer.set(user.id, list);
  }
  await prisma.user.create({
    data: {
      phone: '+8801700000073', fullName: 'Shamim Reza', role: UserRole.CUSTOMER,
      status: AccountStatus.SUSPENDED, suspensionReason: 'Repeated fraudulent refund claims',
      createdAt: at(now, -140 * DAY),
    },
  });

  // -------------------------------------------------------------------------
  // 5. Promotions: banners (all link types + schedule states) & coupons
  // -------------------------------------------------------------------------
  console.log('🖼️  Seeding banners and coupons...');
  const bkGulshan = outletByKey.get('Burger King - Gulshan');
  const sdBanani = outletByKey.get("Sultan's Dine - Banani");
  const phBashundhara = outletByKey.get('Pizza Hut - Bashundhara');
  const kacchiCat = await prisma.category.findFirst({
    where: { vendorId: sdBanani?.id, name: 'Kacchi & Biryani' },
  });

  const bannerSeed: Array<{
    title: string;
    imageUrl: string;
    linkType: BannerLinkType;
    targetId?: string | null;
    targetUrl?: string | null;
    sortOrder: number;
    isActive: boolean;
    startsAt: Date;
    endsAt: Date | null;
  }> = [
    {
      title: 'Burger King Gulshan — Flame-Grilled Fest',
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200',
      linkType: BannerLinkType.OUTLET, targetId: bkGulshan?.id ?? null,
      sortOrder: 1, isActive: true, startsAt: at(now, -20 * DAY), endsAt: at(now, 10 * DAY),
    },
    {
      title: "Kacchi Nights at Sultan's Dine",
      imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=1200',
      linkType: BannerLinkType.CATEGORY, targetId: kacchiCat?.id ?? null,
      sortOrder: 2, isActive: true, startsAt: at(now, -10 * DAY), endsAt: at(now, 20 * DAY),
    },
    {
      title: 'Ramadan Grocery Bundles',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
      linkType: BannerLinkType.EXTERNAL, targetUrl: 'https://example.com/campaigns/ramadan',
      sortOrder: 3, isActive: true, startsAt: at(now, -5 * DAY), endsAt: at(now, 12 * DAY),
    },
    {
      title: 'Refer a Friend, Earn ৳100',
      imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200',
      linkType: BannerLinkType.INTERNAL, targetUrl: '/profile',
      sortOrder: 4, isActive: true, startsAt: at(now, -3 * DAY), endsAt: at(now, 30 * DAY),
    },
    {
      title: "Pizza Lover's Week",
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200',
      linkType: BannerLinkType.OUTLET, targetId: phBashundhara?.id ?? null,
      sortOrder: 5, isActive: true, startsAt: at(now, 3 * DAY), endsAt: at(now, 17 * DAY),
    },
    {
      title: 'Winter Feast (Expired)',
      imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1200',
      linkType: BannerLinkType.INTERNAL, targetUrl: '/orders',
      sortOrder: 6, isActive: true, startsAt: at(now, -60 * DAY), endsAt: at(now, -30 * DAY),
    },
    {
      title: 'Old Summer Splash (Disabled)',
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=1200',
      linkType: BannerLinkType.INTERNAL, targetUrl: '/orders',
      sortOrder: 7, isActive: false, startsAt: at(now, -90 * DAY), endsAt: at(now, -45 * DAY),
    },
  ];
  for (const b of bannerSeed) {
    await prisma.banner.create({
      data: {
        title: b.title, imageUrl: b.imageUrl, linkType: b.linkType,
        targetId: b.targetId ?? null, targetUrl: b.targetUrl ?? null,
        sortOrder: b.sortOrder, isActive: b.isActive,
        startsAt: b.startsAt, endsAt: b.endsAt,
      },
    });
  }

  interface CouponSpec {
    code: string;
    description: string;
    type: DiscountType;
    value: number;
    min: number;
    cap: number | null;
    limit: number;
    fromDays: number;
    toDays: number;
    isActive?: boolean;
    exhausted?: boolean;
  }
  const couponSeed: CouponSpec[] = [
    { code: 'WELCOME50', description: '৳50 flat off your first order over ৳250', type: DiscountType.FLAT, value: 50, min: 250, cap: null, limit: 500, fromDays: -30, toDays: 60 },
    { code: 'BURGER20', description: '20% off burgers (max ৳100) over ৳150', type: DiscountType.PERCENTAGE, value: 20, min: 150, cap: 100, limit: 1000, fromDays: -30, toDays: 60 },
    { code: 'GROCERY10', description: '5% off groceries (max ৳100) over ৳500', type: DiscountType.PERCENTAGE, value: 5, min: 500, cap: 100, limit: 500, fromDays: -25, toDays: 35 },
    { code: 'PHARMA15', description: '৳15 off pharmacy orders over ৳300', type: DiscountType.FLAT, value: 15, min: 300, cap: null, limit: 300, fromDays: -20, toDays: 40 },
    { code: 'BIGBASKET100', description: '৳100 off big baskets over ৳1500', type: DiscountType.FLAT, value: 100, min: 1500, cap: null, limit: 200, fromDays: -15, toDays: 45 },
    { code: 'FITFEAST15', description: '15% off — no cap, over ৳200', type: DiscountType.PERCENTAGE, value: 15, min: 200, cap: null, limit: 400, fromDays: -10, toDays: 50 },
    { code: 'SAVEBIG200', description: '15% off big baskets — currently disabled', type: DiscountType.PERCENTAGE, value: 15, min: 1000, cap: 200, limit: 200, fromDays: -30, toDays: 60, isActive: false },
    { code: 'FLASH30', description: 'Expired flash sale — ৳30 off over ৳100', type: DiscountType.FLAT, value: 30, min: 100, cap: null, limit: 200, fromDays: -45, toDays: -2 },
    { code: 'FIRSTX2', description: '৳50 off — fully redeemed (limit reached)', type: DiscountType.FLAT, value: 50, min: 200, cap: null, limit: 2, fromDays: -30, toDays: 60, exhausted: true },
  ];
  const couponRows = new Map<string, { id: string; type: DiscountType; value: number; cap: number | null; min: number }>();
  for (const c of couponSeed) {
    const row = await prisma.coupon.create({
      data: {
        code: c.code, description: c.description, discountType: c.type,
        discountValue: c.value, minOrderAmount: c.min, maxDiscountAmount: c.cap,
        usageLimit: c.limit, currentUses: c.exhausted ? c.limit : 0,
        validFrom: at(now, c.fromDays * DAY), validTo: at(now, c.toDays * DAY),
        isActive: c.isActive ?? true,
      },
    });
    couponRows.set(c.code, { id: row.id, type: c.type, value: c.value, cap: c.cap, min: c.min });
  }

  console.log('🗂️  Seeding media assets...');
  for (const b of bannerSeed.slice(0, 5)) {
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
        createdAt: b.startsAt,
      },
    });
  }
  await prisma.mediaAsset.create({
    data: {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
      filename: 'campaign-draft-food-festival.jpg',
      originalName: 'food festival draft v2.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: randInt(120_000, 480_000),
      width: 1200,
      height: 630,
      uploadedById: superAdmin.id,
    },
  });
  await prisma.mediaAsset.create({
    data: {
      url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
      filename: 'campaign-draft-mega-sale.jpg',
      originalName: 'mega sale draft.png',
      mimeType: 'image/png',
      sizeBytes: randInt(120_000, 480_000),
      width: 1200,
      height: 630,
      uploadedById: superAdmin.id,
    },
  });

  // -------------------------------------------------------------------------
  // 6. Orders — 30 days of history, cancellations, live pipeline
  // -------------------------------------------------------------------------
  console.log('📦 Generating orders, ledgers, payments, settlements, deposits...');

  type CancelActor = 'CUSTOMER' | 'VENDOR_REJECT' | 'ADMIN' | 'STALE' | 'PAYMENT_TIMEOUT';
  interface PlannedOrder {
    placedAt: Date;
    outlet: OutletCtx;
    customer: CustomerCtx;
    address: AddressCtx | null; // null → takeaway
    items: Array<{
      product: OutletCtx['products'][number];
      variant: OutletCtx['products'][number]['variants'][number] | null;
      qty: number;
    }>;
    method: PaymentMethod;
    couponCode: string | null;
    outcome: 'DELIVERED' | 'CANCELLED' | 'LIVE';
    liveStatus?: OrderStatus;
    riderIssue?: boolean;
    cancel?: {
      stage: OrderStatus; // cancellable stage reached before the cancel
      actor: CancelActor;
      reason: string;
      paidBeforeCancel: boolean; // online paid → refund flow
      paymentTimeout?: boolean; // online unpaid → FAILED sweep
    };
  }

  const liveOutlet = outletCtxs.filter(
    (o) => (o.spec.isActive ?? true) && !(o.spec.isBusy ?? false) &&
      OUTLET_TYPES.find((t) => t.slug === o.spec.typeSlug)?.isActive === true,
  );
  const historyOutlet = outletCtxs; // suspended outlets & cafe type traded earlier in the window
  const orderableCustomers = customerCtxs;

  function weightedPickIndex(pool: OutletCtx[]): number {
    const weights = pool.map((o) => OUTLET_POPULARITY[`${o.spec.brand} - ${o.spec.name}`] ?? 1);
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = rand() * total;
    for (const [i, w] of weights.entries()) {
      roll -= w;
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  function planItems(outlet: OutletCtx, typeSlug: string): PlannedOrder['items'] {
    const isFood = typeSlug === 'restaurant' || typeSlug === 'cafe';
    const count = randInt(1, isFood ? 3 : 5);
    const orderable = outlet.products.filter(
      (p) => p.categoryActive && p.isInStock && p.variants.some((v) => v.isInStock),
    );
    const pool = orderable.length > 0 ? orderable : outlet.products;
    const items: PlannedOrder['items'] = [];
    for (let i = 0; i < count; i++) {
      const product = pick(pool);
      if (items.some((it) => it.product.id === product.id)) continue;
      const liveVariants = product.variants.filter((v) => v.isInStock);
      const variant = pick(liveVariants.length > 0 ? liveVariants : product.variants);
      items.push({ product, variant, qty: randInt(1, isFood ? 3 : 5) });
    }
    if (items.length === 0) {
      const fallback = pool[0];
      const variant = fallback.variants.find((v) => v.isInStock) ?? fallback.variants[0];
      items.push({ product: fallback, variant, qty: 1 });
    }
    return items;
  }

  function planCoupon(subtotal: number, typeSlug: string): string | null {
    if (rand() >= 0.26) return null;
    const eligible = [...couponRows.entries()]
      .filter(([code, c]) => code !== 'SAVEBIG200' && code !== 'FLASH30' && code !== 'FIRSTX2' && subtotal >= c.min)
      .map(([code]) => code);
    if (eligible.length === 0) return null;
    const code = pick(eligible);
    if (code === 'GROCERY10' && !['super-shop', 'grocery', 'pharmacy'].includes(typeSlug)) return null;
    if (code === 'PHARMA15' && typeSlug !== 'pharmacy') return null;
    return code;
  }

  const plans: PlannedOrder[] = [];

  /**
   * Plans one order. The customer is picked first, then the outlet is chosen
   * among outlets whose zone matches one of the customer's saved addresses —
   * mirroring the checkout geofence (no cross-city deliveries).
   * Timing: `{ dayBack }` picks a diurnal hour from the outlet-type pool
   * (Asia/Dhaka local time), `{ minutesAgo }` places a fresh live order.
   */
  function pushPlan(
    outcome: PlannedOrder['outcome'],
    timing: { dayBack: number } | { minutesAgo: number },
    opts?: {
      outlet?: OutletCtx;
      liveStatus?: OrderStatus;
      cancel?: PlannedOrder['cancel'];
      takeaway?: boolean;
      riderIssue?: boolean;
      forceMethod?: PaymentMethod;
    },
  ): void {
    const takeaway = opts?.takeaway ?? false;
    const pool = outcome === 'LIVE' ? liveOutlet : historyOutlet;

    let outlet: OutletCtx | null = opts?.outlet ?? null;
    let customer: CustomerCtx;
    let address: AddressCtx | null = null;

    if (outlet) {
      // Outlet pinned (live pipeline): choose a customer covered by its zone.
      const pinned: OutletCtx = outlet;
      const covered = orderableCustomers.filter((c) =>
        (addressesByCustomer.get(c.id) ?? []).some((a) => a.zone === pinned.spec.zone),
      );
      if (covered.length === 0) return;
      customer = pick(covered);
      const list = addressesByCustomer.get(customer.id) ?? [];
      const zone = pinned.spec.zone;
      address = takeaway ? null : list.find((a) => a.zone === zone) ?? null;
      if (!takeaway && !address) return;
    } else {
      customer = pick(orderableCustomers);
      const addressList = addressesByCustomer.get(customer.id) ?? [];
      if (takeaway) {
        outlet = pool[weightedPickIndex(pool)];
      } else {
        const candidates = pool.filter((o) => addressList.some((a) => a.zone === o.spec.zone));
        if (candidates.length === 0) return;
        outlet = candidates[weightedPickIndex(candidates)];
        const outletZone = outlet.spec.zone;
        address = addressList.find((a) => a.zone === outletZone) ?? null;
        if (!address) return;
      }
    }
    const chosenOutlet: OutletCtx = outlet;
    const chosenCustomer: CustomerCtx = customer;

    let placedAt: Date;
    if ('dayBack' in timing) {
      const hour = pick(HOUR_POOLS[chosenOutlet.spec.typeSlug] ?? HOUR_POOLS.restaurant);
      placedAt = new Date(now.getTime() - timing.dayBack * DAY);
      placedAt.setUTCHours(hour - 6, randInt(0, 59), randInt(0, 59), 0); // Dhaka is UTC+6
      // Keep history safely in the past (delivery lands +35–75 min later).
      if (placedAt.getTime() > now.getTime() - 3.5 * 60 * 60_000) {
        placedAt = new Date(placedAt.getTime() - DAY);
      }
    } else {
      placedAt = new Date(now.getTime() - timing.minutesAgo * 60_000);
    }

    const items = planItems(chosenOutlet, chosenOutlet.spec.typeSlug);
    const subtotal = round2(items.reduce(
      (s, it) => s + (it.variant ? it.variant.price : it.product.price) * it.qty, 0,
    ));
    plans.push({
      placedAt,
      outlet: chosenOutlet,
      customer: chosenCustomer,
      address,
      items,
      method: opts?.forceMethod ?? (rand() < 0.42 ? PaymentMethod.ONLINE_GATEWAY : PaymentMethod.CASH_ON_DELIVERY),
      couponCode: planCoupon(subtotal, chosenOutlet.spec.typeSlug),
      outcome,
      liveStatus: opts?.liveStatus,
      riderIssue: opts?.riderIssue,
      cancel: opts?.cancel,
    });
  }

  // --- Delivered history: 30 days, weekend boost + diurnal shape per type ---
  for (let dayBack = 29; dayBack >= 1; dayBack--) {
    const weekday = new Date(now.getTime() - dayBack * DAY).getUTCDay(); // 5=Fri, 6=Sat (BD weekend)
    const weekend = weekday === 5 || weekday === 6;
    const volume = weekend ? randInt(17, 24) : randInt(11, 15);
    for (let i = 0; i < volume; i++) {
      const takeaway = rand() < 0.05;
      const riderIssue = !takeaway && rand() < 0.006; // re-dispatched mid-flight, still delivered
      pushPlan('DELIVERED', { dayBack }, { takeaway, riderIssue });
    }
  }

  // Same-day delivered history (earlier today).
  for (let i = 0, n = randInt(6, 9); i < n; i++) {
    const takeaway = rand() < 0.05;
    pushPlan('DELIVERED', { minutesAgo: randInt(90, 420) }, { takeaway });
  }

  // --- Cancellations: every actor × cancellable stage × payment outcome ---
  const cancelMatrix: Array<{
    dayBack: number;
    stage: OrderStatus;
    actor: CancelActor;
    reason?: string;
    method?: PaymentMethod;
    paidBeforeCancel?: boolean;
    paymentTimeout?: boolean;
  }> = [
    { dayBack: 18, stage: OrderStatus.PLACED, actor: 'CUSTOMER', reason: 'Changed my mind about the order' },
    { dayBack: 16, stage: OrderStatus.PLACED, actor: 'CUSTOMER' },
    { dayBack: 14, stage: OrderStatus.PLACED, actor: 'VENDOR_REJECT', reason: '[OUT_OF_STOCK] Beef patties finished for tonight' },
    { dayBack: 12, stage: OrderStatus.PLACED, actor: 'VENDOR_REJECT' },
    { dayBack: 10, stage: OrderStatus.PLACED, actor: 'ADMIN', reason: 'Customer reported duplicate order' },
    { dayBack: 8, stage: OrderStatus.PLACED, actor: 'STALE' },
    { dayBack: 7, stage: OrderStatus.PLACED, actor: 'PAYMENT_TIMEOUT', method: PaymentMethod.ONLINE_GATEWAY, paymentTimeout: true },
    { dayBack: 6, stage: OrderStatus.RIDER_ASSIGNED, actor: 'CUSTOMER', reason: 'Delivery is taking too long' },
    { dayBack: 5, stage: OrderStatus.RIDER_ASSIGNED, actor: 'CUSTOMER', reason: 'Ordered from the wrong outlet', method: PaymentMethod.ONLINE_GATEWAY, paidBeforeCancel: true },
    { dayBack: 4, stage: OrderStatus.RIDER_ASSIGNED, actor: 'VENDOR_REJECT', reason: '[RIDER_UNAVAILABLE] Cannot find a courier for this zone' },
    { dayBack: 3, stage: OrderStatus.RIDER_ASSIGNED, actor: 'STALE', method: PaymentMethod.ONLINE_GATEWAY, paidBeforeCancel: true },
    { dayBack: 2, stage: OrderStatus.PREPARING, actor: 'ADMIN', reason: 'Customer requested cancellation via hotline' },
    { dayBack: 2, stage: OrderStatus.PREPARING, actor: 'ADMIN', reason: 'Vendor reported kitchen gas outage', method: PaymentMethod.ONLINE_GATEWAY, paidBeforeCancel: true },
    { dayBack: 1, stage: OrderStatus.READY_FOR_PICKUP, actor: 'ADMIN', reason: 'Vendor closed early due to staff shortage' },
    { dayBack: 0, stage: OrderStatus.PLACED, actor: 'CUSTOMER', reason: 'Accidental checkout', method: PaymentMethod.ONLINE_GATEWAY, paidBeforeCancel: true },
  ];
  for (const c of cancelMatrix) {
    const reason = c.actor === 'CUSTOMER'
      ? c.reason ?? 'Cancelled by customer'
      : c.actor === 'VENDOR_REJECT'
        ? c.reason ?? '[KITCHEN_OVERWHELMED] Order rejected by store kitchen'
        : c.actor === 'ADMIN'
          ? `[ADMIN_FORCE_CANCEL by ${superAdmin.id}] ${c.reason ?? 'Administrative cancellation'}`
          : c.actor === 'STALE'
            ? 'Order expired: not accepted by the kitchen within 60 minutes (system auto-cancel)'
            : 'Online payment timed out (15m window expired)';
    pushPlan('CANCELLED', { dayBack: c.dayBack }, {
      cancel: {
        stage: c.stage,
        actor: c.actor,
        reason,
        paidBeforeCancel: c.paidBeforeCancel ?? false,
        paymentTimeout: c.paymentTimeout,
      },
      forceMethod: c.method,
    });
  }

  // --- Live pipeline: every live FSM state, flow-mode correct & claimable ---
  const riderFirstLive = liveOutlet.filter((o) => o.spec.mode === OrderFlowMode.RIDER_FIRST);
  const vendorFirstLive = liveOutlet.filter((o) => o.spec.mode === OrderFlowMode.VENDOR_FIRST);
  const livePush = (status: OrderStatus, minutesAgo: number, pool: OutletCtx[], opts?: { takeaway?: boolean; forceMethod?: PaymentMethod }): void => {
    pushPlan('LIVE', { minutesAgo }, {
      outlet: pool.length > 0 ? pool[weightedPickIndex(pool)] : undefined,
      liveStatus: status,
      takeaway: opts?.takeaway,
      forceMethod: opts?.forceMethod,
    });
  };
  // Claimable by riders (RIDER_FIRST): fresh enough to survive the 60-min stale sweep.
  livePush(OrderStatus.PLACED, 6, riderFirstLive);
  livePush(OrderStatus.PLACED, 19, riderFirstLive);
  livePush(OrderStatus.PLACED, 37, riderFirstLive, { forceMethod: PaymentMethod.ONLINE_GATEWAY });
  // Claimed, awaiting kitchen accept.
  livePush(OrderStatus.RIDER_ASSIGNED, 9, riderFirstLive);
  livePush(OrderStatus.RIDER_ASSIGNED, 22, riderFirstLive, { forceMethod: PaymentMethod.ONLINE_GATEWAY });
  // Kitchen accepted.
  livePush(OrderStatus.PREPARING, 12, riderFirstLive);
  livePush(OrderStatus.PREPARING, 8, vendorFirstLive);
  livePush(OrderStatus.PREPARING, 5, vendorFirstLive, { takeaway: true });
  // Food ready — VENDOR_FIRST unclaimed (rider-claimable), plus one of each claimed flavour.
  livePush(OrderStatus.READY_FOR_PICKUP, 14, vendorFirstLive);
  livePush(OrderStatus.READY_FOR_PICKUP, 26, vendorFirstLive);
  livePush(OrderStatus.READY_FOR_PICKUP, 18, riderFirstLive);
  livePush(OrderStatus.READY_FOR_PICKUP, 11, vendorFirstLive, { forceMethod: PaymentMethod.ONLINE_GATEWAY });
  // Rider en route with live tracking.
  livePush(OrderStatus.DISPATCHED, 7, riderFirstLive);
  livePush(OrderStatus.DISPATCHED, 15, vendorFirstLive);
  livePush(OrderStatus.DISPATCHED, 4, vendorFirstLive, { forceMethod: PaymentMethod.ONLINE_GATEWAY });

  // Allocate order numbers chronologically per UTC day (checkout semantics).
  plans.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
  const seqByDay = new Map<string, number>();
  function nextOrderNumber(placedAt: Date): string {
    const key = dateStr(placedAt);
    const seq = (seqByDay.get(key) ?? 0) + 1;
    seqByDay.set(key, seq);
    return `ORD-${key}-${String(seq).padStart(4, '0')}`;
  }

  // Reserve distinct online riders for live orders that carry a courier.
  const liveRiderSlots = new Map<PlannedOrder, RiderCtx>();
  {
    const slotPlans = plans.filter((p) => p.outcome === 'LIVE' && p.address !== null && (
      p.liveStatus === OrderStatus.RIDER_ASSIGNED ||
      p.liveStatus === OrderStatus.PREPARING ||
      p.liveStatus === OrderStatus.READY_FOR_PICKUP ||
      p.liveStatus === OrderStatus.DISPATCHED
    ));
    // Rider-first PREPARING/READY_FOR_PICKUP carry the claiming rider; vendor-first
    // PREPARING does not (kitchen accepted, rider not yet called); the single
    // claimed vendor-first READY_FOR_PICKUP is the last slot.
    let claimedVendorReady = 0;
    const pool = approvedRiders.filter((r) => r.online);
    let poolIdx = 0;
    for (const p of slotPlans) {
      const isVendorFirst = p.outlet.spec.mode === OrderFlowMode.VENDOR_FIRST;
      if (isVendorFirst && p.liveStatus === OrderStatus.PREPARING) continue;
      if (isVendorFirst && p.liveStatus === OrderStatus.READY_FOR_PICKUP) {
        claimedVendorReady += 1;
        if (claimedVendorReady > 1) continue;
      }
      const rider = pool[poolIdx % pool.length];
      poolIdx += 1;
      liveRiderSlots.set(p, rider);
    }
  }

  interface CreatedOrder {
    id: string;
    orderNumber: string;
    outletId: string;
    commission: number;
    status: OrderStatus;
    method: PaymentMethod;
    paymentStatus: PaymentStatus;
    netSubtotal: number;
    deliveryFee: number;
    totalAmount: number;
    riderId: string | null;
    placedAt: Date;
    deliveredAt: Date | null;
    destLat: number | null;
    destLng: number | null;
    vendorLat: number;
    vendorLng: number;
    couponCode: string | null;
  }
  const created: CreatedOrder[] = [];
  const liveAssigned: Array<{ order: CreatedOrder; rider: RiderCtx }> = [];

  for (const p of plans) {
    const status: OrderStatus = p.outcome === 'DELIVERED'
      ? OrderStatus.DELIVERED
      : p.outcome === 'CANCELLED'
        ? OrderStatus.CANCELLED
        : p.liveStatus as OrderStatus;
    const takeaway = p.address === null;
    const isVendorFirst = p.outlet.spec.mode === OrderFlowMode.VENDOR_FIRST;

    const subtotal = round2(p.items.reduce(
      (s, it) => s + (it.variant ? it.variant.price : it.product.price) * it.qty, 0,
    ));
    const deliveryFee = takeaway ? 0 : FLAT_DELIVERY_FEE;
    let couponDiscount = 0;
    if (p.couponCode) {
      const c = couponRows.get(p.couponCode);
      if (c) {
        couponDiscount = c.type === DiscountType.PERCENTAGE
          ? Math.min(round2((subtotal * c.value) / 100), c.cap ?? Number.MAX_SAFE_INTEGER)
          : c.value;
        if (couponDiscount > subtotal) couponDiscount = subtotal;
      }
    }
    const netSubtotal = round2(Math.max(0, subtotal - couponDiscount));
    const totalAmount = round2(netSubtotal + deliveryFee);

    let paymentStatus: PaymentStatus;
    if (p.outcome === 'CANCELLED') {
      paymentStatus = p.cancel?.paymentTimeout
        ? PaymentStatus.FAILED
        : p.method === PaymentMethod.ONLINE_GATEWAY && p.cancel?.paidBeforeCancel
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PENDING;
    } else if (p.method === PaymentMethod.ONLINE_GATEWAY) {
      paymentStatus = PaymentStatus.PAID; // dispatch invariant: online orders are prepaid
    } else {
      paymentStatus = status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING;
    }

    let riderId: string | null = null;
    if (!takeaway && p.outcome !== 'CANCELLED') {
      // Cancellation always nulls the courier (central engine behaviour).
      const riderFirstStatuses: OrderStatus[] = [
        OrderStatus.RIDER_ASSIGNED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DISPATCHED, OrderStatus.DELIVERED,
      ];
      const vendorFirstStatuses: OrderStatus[] = [OrderStatus.DISPATCHED, OrderStatus.DELIVERED];
      const applicable = isVendorFirst ? vendorFirstStatuses : riderFirstStatuses;
      if (applicable.includes(status)) {
        if (p.outcome === 'LIVE') {
          const slot = liveRiderSlots.get(p);
          riderId = slot ? slot.id : null;
        } else {
          riderId = pick(approvedRiders).id;
        }
      }
      if (p.outcome === 'LIVE' && isVendorFirst && status === OrderStatus.READY_FOR_PICKUP && liveRiderSlots.has(p)) {
        riderId = liveRiderSlots.get(p)?.id ?? null; // claimed courier, status stays READY_FOR_PICKUP
      }
    }

    const acceptedStatuses: OrderStatus[] = [
      OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.DISPATCHED, OrderStatus.DELIVERED,
    ];
    const reachedAccepted = acceptedStatuses.includes(status) ||
      Boolean(p.cancel && acceptedStatuses.includes(p.cancel.stage));
    const acceptedAt = reachedAccepted ? at(p.placedAt, randInt(1, 4) * 60_000) : null;

    const prepJitter = randInt(-4, 8) * 60_000;
    const pickupOffset = (p.outlet.spec.prep * 60_000) + randInt(3, 10) * 60_000;
    const pickedUpAt = status === OrderStatus.DISPATCHED || status === OrderStatus.DELIVERED
      ? at(p.placedAt, Math.max(3 * 60_000, pickupOffset + prepJitter))
      : null;
    const rideMs = takeaway ? randInt(10, 25) * 60_000 : randInt(8, 25) * 60_000;
    const deliveredAt = status === OrderStatus.DELIVERED
      ? new Date(pickedUpAt!.getTime() + rideMs)
      : null;
    const cancelledAt = p.outcome === 'CANCELLED' ? at(p.placedAt, randInt(4, 55) * 60_000) : null;

    const orderNumber = nextOrderNumber(p.placedAt);
    const commissionRate = p.outlet.spec.commission;
    const commissionAmount = round2((netSubtotal * commissionRate) / 100);

    const addressSnapshot: Record<string, unknown> = takeaway
      ? { deliveryMethod: 'TAKEAWAY', vendorAddress: p.outlet.spec.address }
      : {
          deliveryMethod: 'HOME_DELIVERY',
          addressId: p.address!.id,
          label: p.address!.label,
          addressLine: p.address!.addressLine,
          ...(p.address!.buildingFloor !== null ? { buildingFloor: p.address!.buildingFloor } : {}),
          ...(p.address!.deliveryNote !== null ? { deliveryNote: p.address!.deliveryNote } : {}),
          latitude: p.address!.lat,
          longitude: p.address!.lng,
        };

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: p.customer.id,
        vendorId: p.outlet.id,
        riderId,
        couponId: p.couponCode ? couponRows.get(p.couponCode)?.id ?? null : null,
        status,
        orderFlowMode: p.outlet.spec.mode, // immutable snapshot of the outlet's mode
        subtotal,
        couponDiscount,
        deliveryFee,
        taxAmount: 0,
        totalAmount,
        paymentMethod: p.method,
        paymentStatus,
        deliveryAddressSnapshot: addressSnapshot as unknown as Prisma.InputJsonObject,
        customerPhoneSnapshot: p.customer.phone,
        prepTimeMinutes: p.outlet.spec.prep,
        customerNotes: rand() < 0.15 ? pick(CUSTOMER_NOTES) : null,
        placedAt: p.placedAt,
        acceptedAt,
        pickedUpAt,
        deliveredAt,
        cancelledAt,
        rejectionReason: p.riderIssue
          ? `Delivery issue reported by rider ${pick(approvedRiders).name}: Customer gave the wrong address, re-dispatched`
          : null,
      },
    });

    for (const it of p.items) {
      const unitPrice = it.variant ? it.variant.price : it.product.price;
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.product.id,
          productNameSnapshot: it.product.name,
          unitPrice,
          quantity: it.qty,
          totalPrice: round2(unitPrice * it.qty),
          variantSnapshot: it.variant
            ? { id: it.variant.id, name: it.variant.name, price: it.variant.price } as unknown as Prisma.InputJsonValue
            : Prisma.JsonNull,
        },
      });
    }

    // Commission ledger exists for every non-cancelled order (checkout behaviour,
    // deleted on cancellation by the central engine).
    if (p.outcome !== 'CANCELLED') {
      await prisma.commissionLedger.create({
        data: {
          orderId: order.id,
          vendorId: p.outlet.id,
          grossAmount: netSubtotal,
          commissionRate,
          commissionAmount,
          netVendorPayable: round2(netSubtotal - commissionAmount),
          settlementStatus: SettlementStatus.PENDING,
        },
      });
    }

    // Rider trip ledger is written at delivery confirmation only (rider.service).
    if (status === OrderStatus.DELIVERED && riderId) {
      const earnings = round2(deliveryFee * RIDER_SHARE);
      await prisma.riderTripLedger.create({
        data: {
          orderId: order.id,
          riderId,
          deliveryEarnings: earnings,
          codCollected: p.method === PaymentMethod.CASH_ON_DELIVERY ? totalAmount : 0,
          status: SettlementStatus.PENDING,
        },
      });
    }

    // Gateway payment rows for every ONLINE_GATEWAY order (payments.service).
    if (p.method === PaymentMethod.ONLINE_GATEWAY) {
      const txnTs = p.placedAt.getTime() + 60_000;
      await prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: 'SSLCOMMERZ',
          transactionId: `SSLC-${txnTs}-${hex(8).toUpperCase()}`,
          sessionKey: `SESS-${hex(24)}`,
          amount: totalAmount,
          currency: 'BDT',
          status: paymentStatus,
          gatewayResponse: {
            status: paymentStatus,
            gateway: 'sslcommerz-sandbox',
            valId: `VAL-${orderNumber}`,
            ...(paymentStatus === PaymentStatus.REFUNDED
              ? { refund: { refund_ref_id: `SSLC-REF-${txnTs}-${hex(6).toUpperCase()}`, amount: totalAmount } }
              : {}),
          } as unknown as Prisma.InputJsonObject,
          refundId: paymentStatus === PaymentStatus.REFUNDED ? `SSLC-REF-${txnTs}-${hex(6).toUpperCase()}` : null,
          refundedAt: paymentStatus === PaymentStatus.REFUNDED ? cancelledAt : null,
          paidAt: paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.REFUNDED
            ? at(p.placedAt, randInt(60, 180) * 1000)
            : null,
          failedAt: paymentStatus === PaymentStatus.FAILED ? at(p.placedAt, 15 * 60_000 + 30_000) : null,
          createdAt: p.placedAt,
          updatedAt: p.placedAt,
        },
      });
    }

    const createdOrder: CreatedOrder = {
      id: order.id, orderNumber, outletId: p.outlet.id,
      commission: commissionRate, status, method: p.method, paymentStatus,
      netSubtotal, deliveryFee, totalAmount, riderId, placedAt: p.placedAt,
      deliveredAt, destLat: p.address?.lat ?? null, destLng: p.address?.lng ?? null,
      vendorLat: p.outlet.spec.lat, vendorLng: p.outlet.spec.lng,
      couponCode: p.couponCode,
    };
    created.push(createdOrder);
    if (p.outcome === 'LIVE' && riderId) {
      const slot = liveRiderSlots.get(p);
      if (slot) liveAssigned.push({ order: createdOrder, rider: slot });
    }
  }

  // -------------------------------------------------------------------------
  // 7. Settlements: SETTLED (oldest ~2 weeks) + PROCESSING (week 3) demo batch
  // -------------------------------------------------------------------------
  const deliveredOrders = created.filter((o) => o.status === OrderStatus.DELIVERED && o.deliveredAt !== null);
  const settledCut = at(now, -17 * DAY);
  const processingCut = at(now, -9 * DAY);
  const settledGroup = deliveredOrders.filter((o) => o.deliveredAt! < settledCut);
  const processingGroup = deliveredOrders.filter(
    (o) => o.deliveredAt! >= settledCut && o.deliveredAt! < processingCut,
  );

  async function makeBatch(
    batchNumber: string,
    start: Date,
    end: Date,
    group: CreatedOrder[],
    status: SettlementStatus,
  ): Promise<void> {
    if (group.length === 0) return;
    const trips = await prisma.riderTripLedger.findMany({
      where: { orderId: { in: group.map((o) => o.id) } },
    });
    let vendorPayout = 0;
    let margin = 0;
    for (const o of group) {
      const commission = round2((o.netSubtotal * o.commission) / 100);
      vendorPayout += round2(o.netSubtotal - commission);
      margin += commission;
    }
    // admin.service formula: per-rider net of COD collected, only positive nets.
    const perRider = new Map<string, { earnings: number; cod: number }>();
    for (const t of trips) {
      const agg = perRider.get(t.riderId) ?? { earnings: 0, cod: 0 };
      agg.earnings += Number(t.deliveryEarnings);
      agg.cod += Number(t.codCollected);
      perRider.set(t.riderId, agg);
    }
    let riderPayout = 0;
    for (const agg of perRider.values()) {
      riderPayout += Math.max(0, round2(agg.earnings - agg.cod));
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
    await prisma.commissionLedger.updateMany({
      where: { orderId: { in: group.map((o) => o.id) } },
      data: {
        settlementStatus: status,
        settlementBatchId: batch.id,
        settledAt: status === SettlementStatus.SETTLED ? end : null,
      },
    });
    await prisma.riderTripLedger.updateMany({
      where: { orderId: { in: group.map((o) => o.id) } },
      data: { status, settlementBatchId: batch.id },
    });
  }
  await makeBatch(
    `SETTLE-${dateStr(at(now, -30 * DAY))}-0101`, at(now, -30 * DAY), settledCut,
    settledGroup, SettlementStatus.SETTLED,
  );
  await makeBatch(
    `SETTLE-${dateStr(settledCut)}-0202`, settledCut, processingCut,
    processingGroup, SettlementStatus.PROCESSING,
  );

  // -------------------------------------------------------------------------
  // 8. Rider cash state + deposits (all 3 verification states)
  // -------------------------------------------------------------------------
  const tripByRider = new Map<string, number>();
  for (const t of await prisma.riderTripLedger.findMany()) {
    tripByRider.set(t.riderId, (tripByRider.get(t.riderId) ?? 0) + Number(t.codCollected));
  }
  const liveCodByRider = new Map<string, number>();
  for (const la of liveAssigned) {
    if (la.order.method === PaymentMethod.CASH_ON_DELIVERY) {
      liveCodByRider.set(la.rider.id, (liveCodByRider.get(la.rider.id) ?? 0) + la.order.totalAmount);
    }
  }
  const busyRiderIds = new Set(liveAssigned.map((la) => la.rider.id));

  const depositCandidates = [...tripByRider.entries()]
    .filter(([riderId, gross]) => gross >= 900 && !busyRiderIds.has(riderId))
    .sort((a, b) => b[1] - a[1]);
  const depositPlan: Array<{ riderId: string; amount: number; status: CashDepositStatus; note: string }> = [];
  if (depositCandidates[0]) {
    depositPlan.push({
      riderId: depositCandidates[0][0], amount: round2(depositCandidates[0][1] * 0.5),
      status: CashDepositStatus.APPROVED, note: 'Bank transfer verified via branch slip',
    });
  }
  if (depositCandidates[1]) {
    depositPlan.push({
      riderId: depositCandidates[1][0], amount: round2(depositCandidates[1][1] * 0.4),
      status: CashDepositStatus.APPROVED, note: 'Cash deposited at Banani hub',
    });
  }
  if (depositCandidates[2]) {
    depositPlan.push({
      riderId: depositCandidates[2][0], amount: round2(Math.min(800, depositCandidates[2][1] * 0.3)),
      status: CashDepositStatus.PENDING_APPROVAL, note: 'Awaiting hub verification',
    });
  }
  if (depositCandidates[3]) {
    depositPlan.push({
      riderId: depositCandidates[3][0], amount: round2(Math.min(500, depositCandidates[3][1] * 0.25)),
      status: CashDepositStatus.PENDING_APPROVAL, note: 'Deposited at Gulshan agent point',
    });
  }
  if (depositCandidates[4]) {
    depositPlan.push({
      riderId: depositCandidates[4][0], amount: round2(Math.min(600, depositCandidates[4][1] * 0.3)),
      status: CashDepositStatus.REJECTED, note: 'Reference number mismatch with hub register',
    });
  }
  const approvedDeposits = new Map<string, number>();
  for (const [i, d] of depositPlan.entries()) {
    await prisma.cashDeposit.create({
      data: {
        riderId: d.riderId,
        amount: d.amount,
        status: d.status,
        referenceNo: `DEP-${dateStr(at(now, -(i + 1) * DAY))}-${hex(8)}`,
        note: d.note,
        depositedAt: at(now, -(i + 1) * DAY - randInt(1, 8) * 3_600_000),
      },
    });
    if (d.status === CashDepositStatus.APPROVED) {
      approvedDeposits.set(d.riderId, (approvedDeposits.get(d.riderId) ?? 0) + d.amount);
    }
  }

  for (const r of approvedRiders) {
    const gross = tripByRider.get(r.id) ?? 0;
    const deposits = approvedDeposits.get(r.id) ?? 0;
    let cash = round2(Math.max(0, gross - deposits));
    // Claim-time cash guard: keep live COD assignments within the courier's limit.
    const maxLimit = r.id === approvedRiders[0].id ? 8000 : 5000;
    const liveCod = liveCodByRider.get(r.id) ?? 0;
    if (cash + liveCod > maxLimit) cash = round2(Math.max(0, maxLimit - liveCod));
    await prisma.rider.update({ where: { id: r.id }, data: { cashInHand: cash } });
  }
  // Near-limit demo courier: holdings parked just under the ৳5000 ceiling.
  const busiestFree = [...tripByRider.entries()]
    .filter(([riderId]) => !busyRiderIds.has(riderId))
    .sort((a, b) => b[1] - a[1])[0];
  if (busiestFree) {
    await prisma.rider.update({ where: { id: busiestFree[0] }, data: { cashInHand: 4850 } });
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
  // 10. Redis runtime state — a freshly seeded system must boot clean
  // -------------------------------------------------------------------------
  console.log('⚡ Priming Redis runtime state...');
  const redis = new Redis(process.env.REDIS_URL ?? REDIS_FALLBACK_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
  try {
    await redis.connect();
    const wipePatterns = [
      'order:seq:*', 'rider:active_order:*', 'rider:telemetry:*', 'order:live_location:*',
      'dispatch:escalated:*', 'lock:*', 'otp:*', 'otp_attempts:*', 'ratelimit:otp:*',
      'role_req:*', 'auth:user:*', 'auth:refresh:*', 'geo:*',
    ];
    for (const pattern of wipePatterns) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '500');
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    }
    await redis.del('riders:locations:active');

    // Prime per-day order-number counters so API-generated numbers never
    // collide with the seeded history (checkout retries only 3x).
    for (const [day, seq] of seqByDay) {
      await redis.set(`order:seq:${day}`, String(seq));
      await redis.expire(`order:seq:${day}`, 172800); // match the 48h TTL the API uses
    }

    // Rebuild the rider GEO index + telemetry for online couriers.
    for (const r of approvedRiders.filter((x) => x.online)) {
      const coord = zoneCoord(r.zone);
      await redis.geoadd('riders:locations:active', coord.lng, coord.lat, r.id);
      await redis.set(
        `rider:telemetry:${r.id}`,
        JSON.stringify({
          riderId: r.id, fullName: r.name, phone: r.phone,
          latitude: coord.lat, longitude: coord.lng, bearing: 0, speed: 0,
          updatedAt: new Date().toISOString(),
        }),
        'EX',
        300,
      );
    }

    // Busy markers + mid-route live location for dispatched couriers.
    for (const la of liveAssigned) {
      await redis.set(`rider:active_order:${la.rider.id}`, la.order.id);
      if (la.order.status === OrderStatus.DISPATCHED && la.order.destLat !== null && la.order.destLng !== null) {
        const midLat = round2((la.order.vendorLat + la.order.destLat) / 2 + (rand() - 0.5) * 0.003);
        const midLng = round2((la.order.vendorLng + la.order.destLng) / 2 + (rand() - 0.5) * 0.003);
        await redis.set(
          `order:live_location:${la.order.id}`,
          JSON.stringify({
            riderId: la.rider.id, fullName: la.rider.name, phone: la.rider.phone,
            latitude: midLat, longitude: midLng, bearing: randInt(0, 359), speed: randInt(12, 32),
            estimatedMinutesRemaining: randInt(4, 11),
            updatedAt: new Date().toISOString(),
          }),
          'EX',
          300,
        );
      }
    }
  } catch (e) {
    console.warn(`⚠️ Could not prime Redis runtime state: ${e instanceof Error ? e.message : e}`);
  } finally {
    redis.disconnect();
  }

  // -------------------------------------------------------------------------
  // 11. Reconciliation asserts — a broken seed fails loudly
  // -------------------------------------------------------------------------
  console.log('\n🔍 Reconciling seeded books...');
  const ordersAll = await prisma.order.findMany({ include: { commission: true, riderTrip: true } });
  for (const o of ordersAll) {
    const snapshot = o.deliveryAddressSnapshot as { deliveryMethod?: string };
    const takeaway = snapshot?.deliveryMethod === 'TAKEAWAY';
    if (o.status === OrderStatus.CANCELLED) {
      if (o.commission || o.riderTrip) fail(`cancelled order ${o.orderNumber} must have no ledgers`);
      if (o.riderId) fail(`cancelled order ${o.orderNumber} must have no courier (engine nulls riderId)`);
    } else if (!o.commission) {
      fail(`live/delivered order ${o.orderNumber} missing commission ledger`);
    }
    if (o.status === OrderStatus.DELIVERED && !takeaway && !o.riderTrip) {
      fail(`delivered home-delivery order ${o.orderNumber} missing rider trip ledger`);
    }
    if (takeaway && (o.riderId || o.riderTrip || Number(o.deliveryFee) !== 0)) {
      fail(`takeaway order ${o.orderNumber} must have no courier, trip or delivery fee`);
    }
    if (o.paymentMethod === PaymentMethod.ONLINE_GATEWAY && o.status !== OrderStatus.CANCELLED && o.paymentStatus !== PaymentStatus.PAID) {
      fail(`online order ${o.orderNumber} must be PAID to remain in dispatch`);
    }
    if (o.status === OrderStatus.PLACED && o.orderFlowMode !== OrderFlowMode.RIDER_FIRST) {
      fail(`PLACED order ${o.orderNumber} must belong to a RIDER_FIRST outlet (claimable)`);
    }
    if (o.status === OrderStatus.READY_FOR_PICKUP && o.orderFlowMode !== OrderFlowMode.VENDOR_FIRST && !o.riderId) {
      fail(`unclaimed READY_FOR_PICKUP order ${o.orderNumber} must belong to a VENDOR_FIRST outlet`);
    }
  }
  const catalog = await prisma.product.findMany({
    select: { name: true, basePrice: true, variants: { orderBy: { sortOrder: 'asc' } } },
  });
  for (const p of catalog) {
    if (p.variants.length === 0) fail(`product "${p.name}" has no variants (ADR-017 violation)`);
    if (Number(p.variants[0].price) !== Number(p.basePrice)) {
      fail(`product "${p.name}" basePrice ${p.basePrice} != first variation price ${p.variants[0].price}`);
    }
  }
  const itemsWithoutVariant = await prisma.orderItem.count({
    where: { variantSnapshot: { equals: Prisma.DbNull } },
  });
  if (itemsWithoutVariant > 0) {
    fail(`${itemsWithoutVariant} order items are missing a variant snapshot`);
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
  const deliveredHomeCount = ordersAll.filter(
    (o) => o.status === OrderStatus.DELIVERED && (o.deliveryAddressSnapshot as { deliveryMethod?: string })?.deliveryMethod !== 'TAKEAWAY',
  ).length;
  const expectedEarnings = round2(deliveredHomeCount * FLAT_DELIVERY_FEE * RIDER_SHARE);
  if (Math.abs(Number(tripEarnings._sum.deliveryEarnings ?? 0) - expectedEarnings) > 0.05) {
    fail(`rider earnings mismatch: expected ${expectedEarnings} for ${deliveredHomeCount} deliveries`);
  }

  // -------------------------------------------------------------------------
  // 12. Summary
  // -------------------------------------------------------------------------
  const customerCount = await prisma.user.count({ where: { role: UserRole.CUSTOMER } });
  const gmv = round2(ordersAll
    .filter((o) => o.status === OrderStatus.DELIVERED)
    .reduce((s, o) => s + Number(o.totalAmount), 0));
  const deliveredCount = ordersAll.filter((o) => o.status === OrderStatus.DELIVERED).length;
  const cancelledCount = ordersAll.filter((o) => o.status === OrderStatus.CANCELLED).length;
  const liveCount = ordersAll.length - deliveredCount - cancelledCount;

  console.log(`
============================================================
🎉 DeliveryOS production-realistic seed complete (fresh reset)!
============================================================
👥 Users: ${await prisma.user.count()} (${customerCount} customers incl. 1 suspended, ${await prisma.rider.count()} riders incl. 2 applicants)
🏬 Outlets: ${await prisma.vendor.count()} across ${OUTLET_TYPES.length} types over ${BRANDS.length} brands (Cafe type hidden) · 📦 Products: ${await prisma.product.count()} (+${await prisma.productVariant.count()} variants)
🖼️  Banners: ${await prisma.banner.count()} · 🎟️  Coupons: ${await prisma.coupon.count()} · 🗂️  Media: ${await prisma.mediaAsset.count()}
📦 Orders: ${ordersAll.length} (${deliveredCount} delivered, ${cancelledCount} cancelled, ${liveCount} live) over 30 days
💰 GMV (delivered): ৳${gmv} · Commission: ৳${round2(sumCommission)} · Vendor payable: ৳${round2(sumPayable)} · Rider earnings: ৳${Number(tripEarnings._sum.deliveryEarnings ?? 0)}
🧾 Ledgers: ${await prisma.commissionLedger.count()} commission / ${await prisma.riderTripLedger.count()} trips · Payments: ${await prisma.payment.count()} · Batches: ${await prisma.settlementBatch.count()} · Deposits: ${await prisma.cashDeposit.count()}
🔑 Demo logins (${OTP_LOGIN_NOTE}):
   Super Admin   +8801700000001
   Outlet Mgr    +8801700000002 (Burger King - Gulshan)
   Brand Owner   +8801700000003 (Burger King, all outlets)
   Rider         +8801700000004 (online, active)
   Customer      +8801700000005
   Applicant     +8801700000042 (fleet approval queue demo)
   Suspended     +8801700000073 (suspension flow demo)
============================================================
`);
}
