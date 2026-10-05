import {
  PrismaClient,
  UserRole,
  AccountStatus,
  VendorVertical,
  PermissionScope,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SettlementStatus,
  DiscountType,
  BannerLinkType,
} from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate dates relative to now
const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
const daysAgo = (d: number, hoursOffset = 0) => new Date(now.getTime() - (d * 24 + hoursOffset) * 3600 * 1000);

async function main() {
  console.log('========================================================================');
  console.log('🚀 DeliveryOS Enterprise Massive Database Seeder');
  console.log('   Populating complete multi-vertical, multi-role & historical ecosystem');
  console.log('========================================================================\n');

  // ===========================================================================
  // 1. SYSTEM SETTINGS
  // ===========================================================================
  console.log('⚙️  [1/8] Seeding System Settings...');
  await prisma.systemSetting.upsert({
    where: { key: 'order_flow_config' },
    update: {
      value: {
        mode: 'RIDER_FIRST',
        rider_search_timeout_seconds: 90,
        description: 'Zero Food Waste Mode: Secures rider before kitchen begins prep.',
      },
    },
    create: {
      key: 'order_flow_config',
      value: {
        mode: 'RIDER_FIRST',
        rider_search_timeout_seconds: 90,
        description: 'Zero Food Waste Mode: Secures rider before kitchen begins prep.',
      },
      description: 'Order fulfillment flow sequence (RIDER_FIRST vs VENDOR_FIRST)',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'delivery_fee_config' },
    update: {
      value: {
        mode: 'FIXED_FLAT',
        flatFee: 50.0,
        baseFee: 30.0,
        baseKm: 2.0,
        perKmRate: 10.0,
      },
    },
    create: {
      key: 'delivery_fee_config',
      value: {
        mode: 'FIXED_FLAT',
        flatFee: 50.0,
        baseFee: 30.0,
        baseKm: 2.0,
        perKmRate: 10.0,
      },
      description: 'Delivery fee calculation parameters',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'region_config' },
    update: {
      value: {
        active_region: 'BD',
        supported_regions: {
          BD: {
            currency: 'BDT',
            currency_symbol: '৳',
            default_locale: 'en',
            phone_prefix: '+880',
            tax_percentage: 0.0,
          },
          KSA: {
            currency: 'SAR',
            currency_symbol: '﷼',
            default_locale: 'ar',
            phone_prefix: '+966',
            tax_percentage: 15.0,
          },
        },
      },
    },
    create: {
      key: 'region_config',
      value: {
        active_region: 'BD',
        supported_regions: {
          BD: {
            currency: 'BDT',
            currency_symbol: '৳',
            default_locale: 'en',
            phone_prefix: '+880',
            tax_percentage: 0.0,
          },
          KSA: {
            currency: 'SAR',
            currency_symbol: '﷼',
            default_locale: 'ar',
            phone_prefix: '+966',
            tax_percentage: 15.0,
          },
        },
      },
      description: 'Regional currency, prefix, and taxation parameters',
    },
  });
  console.log('   ✅ System settings initialized.\n');

  // ===========================================================================
  // 2. CORE DEMO USERS (PRESERVING BASELINE CREDENTIALS)
  // ===========================================================================
  console.log('👥 [2/8] Seeding Multi-Role Users (Admins, Managers, Riders, Customers)...');

  // Baseline Super Admin (Port 8080 Quick-Fill)
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+8801700000001' },
    update: { fullName: 'DeliveryOS Super Admin', role: UserRole.SUPER_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000001',
      fullName: 'DeliveryOS Super Admin',
      email: 'admin@deliveryos.local',
      role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  // Additional Super Admins
  const opsAdmin = await prisma.user.upsert({
    where: { phone: '+8801700000010' },
    update: { fullName: 'Sadia Rahman (Operations Director)', role: UserRole.SUPER_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000010',
      fullName: 'Sadia Rahman (Operations Director)',
      email: 'sadia.ops@deliveryos.local',
      role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const financeAdmin = await prisma.user.upsert({
    where: { phone: '+8801700000011' },
    update: { fullName: 'Farhan Ahmed (Head of Finance & Audit)', role: UserRole.SUPER_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000011',
      fullName: 'Farhan Ahmed (Head of Finance & Audit)',
      email: 'farhan.finance@deliveryos.local',
      role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  // Baseline Branch Manager & Brand Owner
  const branchManager = await prisma.user.upsert({
    where: { phone: '+8801700000002' },
    update: { fullName: 'Rahim Uddin (Gulshan Branch Manager)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000002',
      fullName: 'Rahim Uddin (Gulshan Branch Manager)',
      email: 'rahim.manager@burgerpoint.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const brandOwner = await prisma.user.upsert({
    where: { phone: '+8801700000003' },
    update: { fullName: 'Karim Chowdhury (Burger Point Brand Owner)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000003',
      fullName: 'Karim Chowdhury (Burger Point Brand Owner)',
      email: 'karim.owner@burgerpoint.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  // Additional Multi-Vertical Vendor Managers
  const sultansManager = await prisma.user.upsert({
    where: { phone: '+8801700000020' },
    update: { fullName: 'Nasir Hossain (Sultan Dine Head Chef)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000020',
      fullName: 'Nasir Hossain (Sultan Dine Head Chef)',
      email: 'nasir@sultansdine.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const pizzaManager = await prisma.user.upsert({
    where: { phone: '+8801700000021' },
    update: { fullName: 'Marco Rossi (Pizza Roma Head Pizzaiolo)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000021',
      fullName: 'Marco Rossi (Pizza Roma Head Pizzaiolo)',
      email: 'marco@pizzaroma.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const dailyBazaarManager = await prisma.user.upsert({
    where: { phone: '+8801700000022' },
    update: { fullName: 'Mizanur Rahman (Daily Bazaar Store Lead)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000022',
      fullName: 'Mizanur Rahman (Daily Bazaar Store Lead)',
      email: 'mizan@dailybazaar.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const medPlusManager = await prisma.user.upsert({
    where: { phone: '+8801700000023' },
    update: { fullName: 'Dr. Arif Hasan (MedPlus Chief Pharmacist)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000023',
      fullName: 'Dr. Arif Hasan (MedPlus Chief Pharmacist)',
      email: 'arif@medplus.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const sweetBakeryManager = await prisma.user.upsert({
    where: { phone: '+8801700000024' },
    update: { fullName: 'Tania Akter (Sweet Treats Pastry Chef)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000024',
      fullName: 'Tania Akter (Sweet Treats Pastry Chef)',
      email: 'tania@sweettreats.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  // Fleet of 15 Riders across Dhaka
  const riderDefinitions = [
    { phone: '+8801700000004', name: 'Tanvir Hasan (Rider 1)', vehicle: 'motorcycle', online: true, cash: 0.0, lat: 23.7925, lng: 90.4078 },
    { phone: '+8801700000030', name: 'Mehedi Hasan (Rider 2 - Active Trip)', vehicle: 'motorcycle', online: true, cash: 1250.0, lat: 23.7942, lng: 90.4051 },
    { phone: '+8801700000031', name: 'Al-Amin Sheikh (Rider 3 - High Cash)', vehicle: 'motorcycle', online: true, cash: 4850.0, lat: 23.7895, lng: 90.4102 },
    { phone: '+8801700000032', name: 'Robiul Islam (Rider 4 - Offline)', vehicle: 'bicycle', online: false, cash: 320.0, lat: 23.7961, lng: 90.4023 },
    { phone: '+8801700000033', name: 'Sohag Hossain (Rider 5)', vehicle: 'scooter', online: true, cash: 640.0, lat: 23.7915, lng: 90.4089 },
    { phone: '+8801700000034', name: 'Kamrul Islam (Rider 6)', vehicle: 'motorcycle', online: true, cash: 890.0, lat: 23.7882, lng: 90.4067 },
    { phone: '+8801700000035', name: 'Anwar Parvez (Rider 7)', vehicle: 'motorcycle', online: true, cash: 1540.0, lat: 23.7955, lng: 90.4121 },
    { phone: '+8801700000036', name: 'Jahangir Alam (Rider 8)', vehicle: 'bicycle', online: true, cash: 210.0, lat: 23.7901, lng: 90.4035 },
    { phone: '+8801700000037', name: 'Shamim Reza (Rider 9)', vehicle: 'motorcycle', online: true, cash: 1870.0, lat: 23.7938, lng: 90.4095 },
    { phone: '+8801700000038', name: 'Faisal Mahmud (Rider 10)', vehicle: 'scooter', online: true, cash: 450.0, lat: 23.7874, lng: 90.4048 },
    { phone: '+8801700000039', name: 'Babul Akter (Rider 11)', vehicle: 'motorcycle', online: false, cash: 0.0, lat: 23.798, lng: 90.406 },
    { phone: '+8801700000040', name: 'Nazmul Huda (Rider 12)', vehicle: 'motorcycle', online: true, cash: 2300.0, lat: 23.792, lng: 90.401 },
    { phone: '+8801700000041', name: 'Zahidul Islam (Rider 13)', vehicle: 'scooter', online: true, cash: 780.0, lat: 23.786, lng: 90.411 },
    { phone: '+8801700000042', name: 'Rasel Ahmed (Rider 14)', vehicle: 'bicycle', online: true, cash: 150.0, lat: 23.794, lng: 90.414 },
    { phone: '+8801700000043', name: 'Mokbul Hossain (Rider 15)', vehicle: 'motorcycle', online: true, cash: 3100.0, lat: 23.789, lng: 90.402 },
  ];

  const seededRiders: { id: string; userId: string; name: string }[] = [];

  for (const r of riderDefinitions) {
    const rUser = await prisma.user.upsert({
      where: { phone: r.phone },
      update: { fullName: r.name, role: UserRole.RIDER, status: AccountStatus.ACTIVE },
      create: {
        phone: r.phone,
        fullName: r.name,
        email: `${r.phone.replace('+', '')}@deliveryos.rider`,
        role: UserRole.RIDER,
        status: AccountStatus.ACTIVE,
      },
    });

    const riderProfile = await prisma.rider.upsert({
      where: { userId: rUser.id },
      update: {
        vehicleType: r.vehicle,
        isOnline: r.online,
        cashInHand: r.cash,
        maxCashLimit: 5000.0,
        latitude: r.lat,
        longitude: r.lng,
      },
      create: {
        userId: rUser.id,
        vehicleType: r.vehicle,
        isOnline: r.online,
        cashInHand: r.cash,
        maxCashLimit: 5000.0,
        latitude: r.lat,
        longitude: r.lng,
      },
    });

    seededRiders.push({ id: riderProfile.id, userId: rUser.id, name: r.name });
  }

  // 20 Customers across Banani, Gulshan, Baridhara, Dhanmondi
  const customerDefinitions = [
    { phone: '+8801700000005', name: 'Sultana Razia', label: 'Home', address: 'House 42, Road 11, Banani, Dhaka', lat: 23.7937, lng: 90.4043 },
    { phone: '+8801700000050', name: 'Mahmudul Karim', label: 'Home', address: 'Apt 5B, Road 7, Gulshan 1, Dhaka', lat: 23.7885, lng: 90.4095 },
    { phone: '+8801700000051', name: 'Ayesha Siddiqua', label: 'Office', address: 'Crystal Palace, Gulshan 2, Dhaka', lat: 23.7921, lng: 90.4112 },
    { phone: '+8801700000052', name: 'Kazi Niaz Ahmed', label: 'Home', address: 'Block D, Road 4, Baridhara Diplomatic Zone', lat: 23.7995, lng: 90.4182 },
    { phone: '+8801700000053', name: 'Tasnim Ferdous', label: 'Home', address: 'Plot 18, Block B, Niketan, Gulshan, Dhaka', lat: 23.7812, lng: 90.4071 },
    { phone: '+8801700000054', name: 'Tanveer Choudhury', label: 'Office', address: 'Ahmed Tower, Kemal Ataturk Ave, Banani', lat: 23.7944, lng: 90.4039 },
    { phone: '+8801700000055', name: 'Nusrat Jahan', label: 'Home', address: 'House 12, Road 18, Gulshan 1, Dhaka', lat: 23.7872, lng: 90.4124 },
    { phone: '+8801700000056', name: 'Imtiaz Hossain', label: 'Home', address: 'Apt 2A, Road 27, Block K, Banani', lat: 23.7978, lng: 90.4015 },
    { phone: '+8801700000057', name: 'Samira Huq', label: 'Home', address: 'House 88, Road 13, Block D, Banani', lat: 23.7919, lng: 90.4068 },
    { phone: '+8801700000058', name: 'Saifur Rahman', label: 'Office', address: 'Green Grandeur, Road 103, Gulshan 2', lat: 23.7951, lng: 90.4143 },
    { phone: '+8801700000059', name: 'Farzana Parveen', label: 'Home', address: 'House 31, Road 4, Dhanmondi, Dhaka', lat: 23.7461, lng: 90.3742 },
    { phone: '+8801700000060', name: 'Arifur Rahman', label: 'Home', address: 'House 5, Road 2A, Baridhara, Dhaka', lat: 23.8012, lng: 90.4195 },
    { phone: '+8801700000061', name: 'Zannatul Ferdous', label: 'Home', address: 'Apt 3C, Road 17, Banani, Dhaka', lat: 23.7958, lng: 90.4047 },
    { phone: '+8801700000062', name: 'Rashedul Hasan', label: 'Office', address: 'Simpletree Anarkali, Gulshan 2', lat: 23.7932, lng: 90.4082 },
    { phone: '+8801700000063', name: 'Sabiha Sultana', label: 'Home', address: 'House 14, Road 8, Niketan, Dhaka', lat: 23.7825, lng: 90.4088 },
    { phone: '+8801700000064', name: 'Muntasir Billah', label: 'Home', address: 'Plot 7, Road 55, Gulshan 2, Dhaka', lat: 23.7965, lng: 90.4132 },
    { phone: '+8801700000065', name: 'Dilruba Begum', label: 'Home', address: 'House 22, Road 10, Banani DOHS', lat: 23.7989, lng: 90.3985 },
    { phone: '+8801700000066', name: 'Shahidul Alam', label: 'Home', address: 'House 45, Road 12, Gulshan 1, Dhaka', lat: 23.7865, lng: 90.4115 },
    { phone: '+8801700000067', name: 'Nabila Mehjabin', label: 'Home', address: 'Apt 4A, Road 23, Block B, Banani', lat: 23.7962, lng: 90.4029 },
    { phone: '+8801700000068', name: 'Moniruzzaman Khan', label: 'Office', address: 'Bay’s Galleria, Gulshan Avenue', lat: 23.7892, lng: 90.4149 },
  ];

  const seededCustomers: { id: string; name: string; phone: string; addressSnapshot: any }[] = [];

  for (const c of customerDefinitions) {
    const cUser = await prisma.user.upsert({
      where: { phone: c.phone },
      update: { fullName: c.name, role: UserRole.CUSTOMER, status: AccountStatus.ACTIVE },
      create: {
        phone: c.phone,
        fullName: c.name,
        email: `${c.phone.replace('+', '')}@customer.local`,
        role: UserRole.CUSTOMER,
        status: AccountStatus.ACTIVE,
      },
    });

    await prisma.customerAddress.deleteMany({ where: { userId: cUser.id } });
    const addr = await prisma.customerAddress.create({
      data: {
        userId: cUser.id,
        label: c.label,
        addressLine: c.address,
        buildingFloor: 'Apartment / Suite',
        deliveryNote: 'Call on reaching the security gate',
        latitude: c.lat,
        longitude: c.lng,
        isDefault: true,
      },
    });

    seededCustomers.push({
      id: cUser.id,
      name: c.name,
      phone: c.phone,
      addressSnapshot: {
        addressLine: addr.addressLine,
        label: addr.label,
        latitude: addr.latitude,
        longitude: addr.longitude,
      },
    });
  }
  console.log(`   ✅ 3 Super Admins, 6 Managers, ${seededRiders.length} Riders, and ${seededCustomers.length} Customers seeded.\n`);

  // ===========================================================================
  // 3. VENDOR BRANDS & OUTLETS (ALL 4 VERTICALS)
  // ===========================================================================
  console.log('🏪 [3/8] Seeding 12 Outlets across all 4 Verticals (Food, Grocery, Super Shop, Pharmacy)...');

  // Brand 1: Burger Point (Chain)
  let burgerBrand = await prisma.vendorBrand.findFirst({ where: { name: 'Burger Point' } });
  if (!burgerBrand) {
    burgerBrand = await prisma.vendorBrand.create({
      data: {
        name: 'Burger Point',
        logoUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200',
      },
    });
  }

  // Outlet 1: Gulshan Branch (Food)
  let gulshanOutlet = await prisma.vendor.findFirst({ where: { name: 'Burger Point — Gulshan Branch' } });
  if (!gulshanOutlet) {
    gulshanOutlet = await prisma.vendor.create({
      data: {
        brandId: burgerBrand.id,
        name: 'Burger Point — Gulshan Branch',
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000001',
        logoUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
        latitude: 23.7925,
        longitude: 90.4078,
        addressText: 'Plot 15, Block CWN(A), Kamal Ataturk Ave, Gulshan 2, Dhaka',
        commissionRate: 15.0,
        deliveryRadiusKm: 5.0,
        defaultPrepTimeMinutes: 20,
        isActive: true,
      },
    });
  }

  // Outlet 2: Dhanmondi Branch (Food)
  let dhanmondiOutlet = await prisma.vendor.findFirst({ where: { name: 'Burger Point — Dhanmondi Branch' } });
  if (!dhanmondiOutlet) {
    dhanmondiOutlet = await prisma.vendor.create({
      data: {
        brandId: burgerBrand.id,
        name: 'Burger Point — Dhanmondi Branch',
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000002',
        logoUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
        latitude: 23.7461,
        longitude: 90.3742,
        addressText: 'Road 27, Dhanmondi, Dhaka',
        commissionRate: 15.0,
        deliveryRadiusKm: 4.5,
        defaultPrepTimeMinutes: 25,
        isActive: true,
      },
    });
  }


// Brands are mandatory (ADR-017): each outlet is backed by an auto-named brand.
async function ensureBrandFor(name: string): Promise<string> {
  const existing = await prisma.vendorBrand.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.vendorBrand.create({ data: { name } });
  return created.id;
}

  // Outlet 3: Sultan's Dine (Food - Biryani)
  let sultansOutlet = await prisma.vendor.findFirst({ where: { name: "Sultan's Dine — Gulshan 2" } });
  if (!sultansOutlet) {
    sultansOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor("Sultan's Dine"),
        name: "Sultan's Dine — Gulshan 2",
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000010',
        logoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800',
        latitude: 23.7915,
        longitude: 90.4105,
        addressText: 'Road 104, Gulshan 2, Dhaka',
        commissionRate: 18.0,
        deliveryRadiusKm: 6.0,
        defaultPrepTimeMinutes: 30,
        isActive: true,
      },
    });
  }

  // Outlet 4: Pizza Roma Woodfired (Food - Italian)
  let pizzaOutlet = await prisma.vendor.findFirst({ where: { name: 'Pizza Roma Woodfired — Banani' } });
  if (!pizzaOutlet) {
    pizzaOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Pizza Roma'),
        name: 'Pizza Roma Woodfired — Banani',
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000011',
        logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
        latitude: 23.7948,
        longitude: 90.4042,
        addressText: 'Road 11, Block E, Banani, Dhaka',
        commissionRate: 15.0,
        deliveryRadiusKm: 5.0,
        defaultPrepTimeMinutes: 20,
        isActive: true,
      },
    });
  }

  // Outlet 5: Sweet Treats Bakery (Food - Cafe)
  let sweetBakeryOutlet = await prisma.vendor.findFirst({ where: { name: 'Sweet Treats Bakery & Artisan Cafe' } });
  if (!sweetBakeryOutlet) {
    sweetBakeryOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Sweet Treats Bakery'),
        name: 'Sweet Treats Bakery & Artisan Cafe',
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000012',
        logoUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
        latitude: 23.7985,
        longitude: 90.4158,
        addressText: 'Park Road, Baridhara, Dhaka',
        commissionRate: 12.0,
        deliveryRadiusKm: 4.0,
        defaultPrepTimeMinutes: 15,
        isActive: true,
      },
    });
  }

  // Outlet 6: FreshMart Super Shop (Super Shop)
  let freshMartBrand = await prisma.vendorBrand.findFirst({ where: { name: 'FreshMart Daily Super Shop' } });
  if (!freshMartBrand) {
    freshMartBrand = await prisma.vendorBrand.create({
      data: {
        name: 'FreshMart Daily Super Shop',
        logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200',
      },
    });
  }

  let freshMartOutlet = await prisma.vendor.findFirst({ where: { name: 'FreshMart Daily — Gulshan Hub' } });
  if (!freshMartOutlet) {
    freshMartOutlet = await prisma.vendor.create({
      data: {
        brandId: freshMartBrand.id,
        name: 'FreshMart Daily — Gulshan Hub',
        vertical: VendorVertical.SUPER_SHOP,
        contactPhone: '+8801711000003',
        logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
        latitude: 23.7912,
        longitude: 90.4065,
        addressText: 'Gulshan 1 DCC Market, Dhaka',
        commissionRate: 10.0,
        deliveryRadiusKm: 6.0,
        defaultPrepTimeMinutes: 15,
        isActive: true,
      },
    });
  }

  // Outlet 7: Unimart Megastore Express (Super Shop)
  let unimartOutlet = await prisma.vendor.findFirst({ where: { name: 'Unimart Megastore Express — Gulshan 2' } });
  if (!unimartOutlet) {
    unimartOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Unimart'),
        name: 'Unimart Megastore Express — Gulshan 2',
        vertical: VendorVertical.SUPER_SHOP,
        contactPhone: '+8801711000015',
        logoUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=800',
        latitude: 23.7935,
        longitude: 90.4148,
        addressText: 'Gulshan Center Point, Gulshan 2, Dhaka',
        commissionRate: 8.0,
        deliveryRadiusKm: 7.0,
        defaultPrepTimeMinutes: 20,
        isActive: true,
      },
    });
  }

  // Outlet 8: Daily Bazaar Express (Grocery)
  let dailyBazaarOutlet = await prisma.vendor.findFirst({ where: { name: 'Daily Bazaar Express — Banani 11' } });
  if (!dailyBazaarOutlet) {
    dailyBazaarOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Daily Bazaar'),
        name: 'Daily Bazaar Express — Banani 11',
        vertical: VendorVertical.GROCERY,
        contactPhone: '+8801711000016',
        logoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
        latitude: 23.7928,
        longitude: 90.4038,
        addressText: 'House 56, Road 11, Block D, Banani',
        commissionRate: 10.0,
        deliveryRadiusKm: 5.0,
        defaultPrepTimeMinutes: 15,
        isActive: true,
      },
    });
  }

  // Outlet 9: Organic Valley Produce (Grocery)
  let organicOutlet = await prisma.vendor.findFirst({ where: { name: 'Organic Valley Fresh Produce — Baridhara' } });
  if (!organicOutlet) {
    organicOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Organic Valley'),
        name: 'Organic Valley Fresh Produce — Baridhara',
        vertical: VendorVertical.GROCERY,
        contactPhone: '+8801711000017',
        logoUrl: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1506484381205-f7945653044d?w=800',
        latitude: 23.7981,
        longitude: 90.4172,
        addressText: 'Road 9, Baridhara DOHS, Dhaka',
        commissionRate: 12.0,
        deliveryRadiusKm: 4.5,
        defaultPrepTimeMinutes: 10,
        isActive: true,
      },
    });
  }

  // Outlet 10: MedPlus 24/7 Pharmacy (Pharmacy)
  let medPlusOutlet = await prisma.vendor.findFirst({ where: { name: 'MedPlus 24/7 Pharmacy — Banani Road 11' } });
  if (!medPlusOutlet) {
    medPlusOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('MedPlus'),
        name: 'MedPlus 24/7 Pharmacy — Banani Road 11',
        vertical: VendorVertical.PHARMACY,
        contactPhone: '+8801711000018',
        logoUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800',
        latitude: 23.7941,
        longitude: 90.4055,
        addressText: 'House 82, Road 11, Banani, Dhaka',
        commissionRate: 10.0,
        deliveryRadiusKm: 6.0,
        defaultPrepTimeMinutes: 10,
        isActive: true,
      },
    });
  }

  // Outlet 11: HealthCare Wellness Pharmacy (Pharmacy)
  let healthCareOutlet = await prisma.vendor.findFirst({ where: { name: 'HealthCare Wellness & OTC — Gulshan' } });
  if (!healthCareOutlet) {
    healthCareOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('HealthCare Wellness'),
        name: 'HealthCare Wellness & OTC — Gulshan',
        vertical: VendorVertical.PHARMACY,
        contactPhone: '+8801711000019',
        logoUrl: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
        latitude: 23.7891,
        longitude: 90.4085,
        addressText: 'South Avenue, Gulshan 1, Dhaka',
        commissionRate: 10.0,
        deliveryRadiusKm: 5.5,
        defaultPrepTimeMinutes: 10,
        isActive: true,
      },
    });
  }

  // Outlet 12: Chai & Snack Station (Food - Street/Quick)
  let chaiOutlet = await prisma.vendor.findFirst({ where: { name: 'Chai & Snack Station — Mohakhali' } });
  if (!chaiOutlet) {
    chaiOutlet = await prisma.vendor.create({
      data: {
        brandId: await ensureBrandFor('Chai & Snack Station'),
        name: 'Chai & Snack Station — Mohakhali',
        vertical: VendorVertical.FOOD,
        contactPhone: '+8801711000020',
        logoUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        latitude: 23.7785,
        longitude: 90.4012,
        addressText: 'Wireless Gate, Mohakhali, Dhaka',
        commissionRate: 15.0,
        deliveryRadiusKm: 3.5,
        defaultPrepTimeMinutes: 10,
        isActive: true,
      },
    });
  }

  const allVendors = [
    gulshanOutlet,
    dhanmondiOutlet,
    sultansOutlet,
    pizzaOutlet,
    sweetBakeryOutlet,
    freshMartOutlet,
    unimartOutlet,
    dailyBazaarOutlet,
    organicOutlet,
    medPlusOutlet,
    healthCareOutlet,
    chaiOutlet,
  ];

  // Configure staff permissions
  await prisma.vendorStaff.deleteMany({ where: { userId: branchManager.id } });
  await prisma.vendorStaff.create({
    data: {
      userId: branchManager.id,
      vendorId: gulshanOutlet.id,
      brandId: burgerBrand.id,
      scope: PermissionScope.PARTICULAR_OUTLET,
    },
  });

  await prisma.vendorStaff.deleteMany({ where: { userId: brandOwner.id } });
  await prisma.vendorStaff.create({
    data: {
      userId: brandOwner.id,
      brandId: burgerBrand.id,
      scope: PermissionScope.ALL_OUTLETS_MASTER,
    },
  });

  // Assign other managers
  await prisma.vendorStaff.upsert({
    where: { userId_vendorId: { userId: sultansManager.id, vendorId: sultansOutlet.id } },
    update: { scope: PermissionScope.PARTICULAR_OUTLET },
    create: { userId: sultansManager.id, vendorId: sultansOutlet.id, scope: PermissionScope.PARTICULAR_OUTLET },
  });

  await prisma.vendorStaff.upsert({
    where: { userId_vendorId: { userId: pizzaManager.id, vendorId: pizzaOutlet.id } },
    update: { scope: PermissionScope.PARTICULAR_OUTLET },
    create: { userId: pizzaManager.id, vendorId: pizzaOutlet.id, scope: PermissionScope.PARTICULAR_OUTLET },
  });

  await prisma.vendorStaff.upsert({
    where: { userId_vendorId: { userId: dailyBazaarManager.id, vendorId: dailyBazaarOutlet.id } },
    update: { scope: PermissionScope.PARTICULAR_OUTLET },
    create: { userId: dailyBazaarManager.id, vendorId: dailyBazaarOutlet.id, scope: PermissionScope.PARTICULAR_OUTLET },
  });

  await prisma.vendorStaff.upsert({
    where: { userId_vendorId: { userId: medPlusManager.id, vendorId: medPlusOutlet.id } },
    update: { scope: PermissionScope.PARTICULAR_OUTLET },
    create: { userId: medPlusManager.id, vendorId: medPlusOutlet.id, scope: PermissionScope.PARTICULAR_OUTLET },
  });

  // 7-day Operating Hours for all 12 Outlets
  for (const v of allVendors) {
    for (let day = 0; day <= 6; day++) {
      await prisma.vendorOperatingHour.upsert({
        where: { vendorId_dayOfWeek: { vendorId: v.id, dayOfWeek: day } },
        update: { openTime: '08:00:00', closeTime: '23:30:00', isClosed: false },
        create: { vendorId: v.id, dayOfWeek: day, openTime: '08:00:00', closeTime: '23:30:00', isClosed: false },
      });
    }
  }
  console.log(`   ✅ 12 Outlets configured with 7-day operating hours and manager roles.\n`);

  // ===========================================================================
  // 4. EXTENSIVE CATALOGS (FOOD, GROCERY, SUPER SHOP, PHARMACY)
  // ===========================================================================
  console.log('🍔 [4/8] Seeding 50+ Products with Variants and Add-ons across all verticals...');

  const allProducts: { id: string; vendorId: string; name: string; basePrice: number }[] = [];

  // Helper to add product
  async function seedProduct(
    vendorId: string,
    categoryName: string,
    pData: {
      name: string;
      desc: string;
      price: number;
      unit: string;
      image: string;
      inStock?: boolean;
      variants?: { name: string; modifier: number; price?: number }[];
    }
  ) {
    let cat = await prisma.category.findFirst({ where: { vendorId, name: categoryName } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { vendorId, name: categoryName, isActive: true },
      });
    }

    const prod = await prisma.product.create({
      data: {
        vendorId,
        categoryId: cat.id,
        name: pData.name,
        description: pData.desc,
        basePrice: pData.price,
        unitType: pData.unit,
        imageUrl: pData.image,
        isInStock: pData.inStock !== false,
      },
    });

    allProducts.push({ id: prod.id, vendorId, name: prod.name, basePrice: pData.price });

    if (pData.variants && pData.variants.length > 0) {
      await prisma.productVariant.createMany({
        data: pData.variants.map((v, index) => ({
          productId: prod.id,
          name: v.name,
          price: v.price ?? pData.price + v.modifier,
          sortOrder: index + 1,
          isInStock: true,
        })),
      });
    }

    return prod;
  }

  // --- BURGER POINT GULSHAN ---
  await seedProduct(gulshanOutlet.id, 'Gourmet Burgers', {
    name: 'Classic Smoky Beef Burger',
    desc: 'Flame-grilled 150g beef patty with melted cheddar, smoked caramelized onions, and house barbecue sauce.',
    price: 320.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    variants: [
      { name: 'Single Patty (150g)', modifier: 0.0 },
      { name: 'Double Patty (300g)', modifier: 120.0 },
      { name: 'Triple Monster (450g)', modifier: 220.0 },
    ],
  });

  await seedProduct(gulshanOutlet.id, 'Gourmet Burgers', {
    name: 'Peri-Peri Crispy Chicken Burger',
    desc: 'Crispy fried chicken breast fillet tossed in spicy peri-peri seasoning with fresh iceberg lettuce.',
    price: 280.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400',
    variants: [
      { name: 'Regular Zesty', modifier: 0.0 },
      { name: 'Extra Fiery Hot', modifier: 20.0 },
    ],
  });

  await seedProduct(gulshanOutlet.id, 'Gourmet Burgers', {
    name: 'Double Truffle Mushroom Swiss',
    desc: 'Two smashed patties with sautéed portobello mushrooms and black truffle garlic butter.',
    price: 450.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400',
  });

  await seedProduct(gulshanOutlet.id, 'Crispy Sides & Fries', {
    name: 'Seasoned French Fries',
    desc: 'Golden skin-on potato fries tossed in rosemary garlic sea salt.',
    price: 120.0,
    unit: 'pack',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400',
  });

  await seedProduct(gulshanOutlet.id, 'Crispy Sides & Fries', {
    name: 'Loaded Chili Cheese Nachos',
    desc: 'Corn tortilla chips topped with spicy minced beef chili, cheese sauce, and jalapeños.',
    price: 260.0,
    unit: 'pack',
    image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400',
  });

  // --- SULTAN'S DINE ---
  await seedProduct(sultansOutlet.id, 'Signature Kacchi', {
    name: 'Royal Basmati Mutton Kacchi Biryani',
    desc: 'Fragrant aromatic Basmati rice slow cooked in steam (dum) with tender marinated mutton and aloo.',
    price: 490.0,
    unit: 'platter',
    image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400',
    variants: [
      { name: 'Regular Platter', modifier: 0.0 },
      { name: 'King Platter with Extra Mutton', modifier: 180.0 },
    ],
  });

  await seedProduct(sultansOutlet.id, 'Signature Kacchi', {
    name: 'Special Chicken Roast',
    desc: 'Traditional wedding-style caramelized onion and yogurt slow braised chicken leg quarter.',
    price: 180.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
  });

  await seedProduct(sultansOutlet.id, 'Beverages & Desserts', {
    name: 'Traditional Mint Borhani',
    desc: 'Refreshing spiced savory yogurt drink brewed with mint, coriander, mustard, and roasted cumin.',
    price: 90.0,
    unit: 'glass',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400',
  });

  await seedProduct(sultansOutlet.id, 'Beverages & Desserts', {
    name: 'Shahi Zafrani Firni',
    desc: 'Creamy slow-reduced rice pudding infused with pure Kashmiri saffron and crushed pistachios.',
    price: 110.0,
    unit: 'cup',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400',
  });

  // --- PIZZA ROMA ---
  await seedProduct(pizzaOutlet.id, 'Woodfired Pizzas', {
    name: 'Diavola Spicy Beef Pepperoni Pizza',
    desc: 'San Marzano tomato sauce, fresh mozzarella fior di latte, cured beef pepperoni, and chili flakes.',
    price: 680.0,
    unit: '12 inch',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400',
    variants: [
      { name: "10-inch Medium", modifier: -120.0 },
      { name: "12-inch Large", modifier: 0.0 },
      { name: "14-inch Family Feast", modifier: 250.0 },
    ],
  });

  await seedProduct(pizzaOutlet.id, 'Woodfired Pizzas', {
    name: 'Quattro Formaggi (Four Cheese)',
    desc: 'Mozzarella, Gorgonzola, Fontina, and shaved Parmigiano Reggiano on white cream base.',
    price: 720.0,
    unit: '12 inch',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
  });

  await seedProduct(pizzaOutlet.id, 'Handmade Pastas', {
    name: 'Creamy Fettuccine Alfredo with Grilled Chicken',
    desc: 'Silky egg pasta ribbons tossed in aged parmesan butter sauce with sliced herb chicken breast.',
    price: 420.0,
    unit: 'plate',
    image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400',
  });

  // --- SWEET TREATS BAKERY ---
  await seedProduct(sweetBakeryOutlet.id, 'Artisan Pastries', {
    name: 'French Butter Croissant',
    desc: 'Flaky 27-layer golden baked croissant made with premium Normandy butter.',
    price: 140.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
  });

  await seedProduct(sweetBakeryOutlet.id, 'Artisan Pastries', {
    name: 'Belgian Dark Chocolate Fudge Cake Slice',
    desc: 'Rich 70% Callebaut dark chocolate sponge layered with silky ganache.',
    price: 220.0,
    unit: 'slice',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
  });

  await seedProduct(sweetBakeryOutlet.id, 'Specialty Coffee', {
    name: 'Hot Caramel Macchiato',
    desc: 'Freshly pulled double espresso over steamed whole milk and Madagascar vanilla caramel.',
    price: 190.0,
    unit: 'cup',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
  });

  // --- FRESHMART & DAILY BAZAAR (GROCERY & SUPER SHOP) ---
  await seedProduct(dailyBazaarOutlet.id, 'Fresh Produce', {
    name: 'Fresh Cavendish Bananas',
    desc: 'Naturally ripened, premium sweet bananas from regional farms.',
    price: 90.0,
    unit: 'dozen',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
  });

  await seedProduct(dailyBazaarOutlet.id, 'Fresh Produce', {
    name: 'Organic Red Tomatoes',
    desc: 'Fresh greenhouse-grown red tomatoes, firm and juicy.',
    price: 70.0,
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
  });

  await seedProduct(dailyBazaarOutlet.id, 'Dairy & Eggs', {
    name: 'Pasteurized Whole Milk (1L)',
    desc: 'Farm fresh homogenized whole dairy milk with 3.5% fat.',
    price: 95.0,
    unit: 'packet',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
  });

  await seedProduct(dailyBazaarOutlet.id, 'Dairy & Eggs', {
    name: 'Farm Fresh Brown Eggs',
    desc: 'Grade-A farm eggs, cleaned and inspected for freshness.',
    price: 145.0,
    unit: '12 pcs',
    image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=400',
  });

  await seedProduct(unimartOutlet.id, 'Pantry & Grains', {
    name: 'Premium Miniket Rice (5kg)',
    desc: 'Triple-sorted long grain polished fragrant white rice.',
    price: 360.0,
    unit: '5kg bag',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
  });

  await seedProduct(unimartOutlet.id, 'Pantry & Grains', {
    name: 'Spanish Extra Virgin Olive Oil (1L)',
    desc: 'First cold-pressed extra virgin olive oil with rich fruity aroma.',
    price: 1150.0,
    unit: 'bottle',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400',
  });

  // --- MEDPLUS PHARMACY ---
  await seedProduct(medPlusOutlet.id, 'OTC Healthcare', {
    name: 'Paracetamol Fast Action 500mg',
    desc: 'Relief from mild to moderate fever, headaches, and muscle aches (Box of 10 strips).',
    price: 120.0,
    unit: 'box',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
  });

  await seedProduct(medPlusOutlet.id, 'OTC Healthcare', {
    name: 'Vitamin C Effervescent 1000mg',
    desc: 'Immune support dietary supplement with natural orange flavor (20 tablets tube).',
    price: 380.0,
    unit: 'tube',
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400',
  });

  await seedProduct(medPlusOutlet.id, 'First Aid & Wellness', {
    name: 'Antiseptic Liquid Disinfectant 500ml',
    desc: 'Hospital grade multi-purpose antiseptic disinfectant for wound cleansing and sanitization.',
    price: 240.0,
    unit: 'bottle',
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400',
  });

  await seedProduct(medPlusOutlet.id, 'First Aid & Wellness', {
    name: 'Digital Upper Arm Blood Pressure Monitor',
    desc: 'One-touch clinical accuracy blood pressure and heart rate monitor with memory recall.',
    price: 2450.0,
    unit: 'piece',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400',
  });

  // --- CHAI & SNACK STATION ---
  await seedProduct(chaiOutlet.id, 'Hot Brews', {
    name: 'Special Masala Malai Chai',
    desc: 'Slow-simmered rich clay-pot tea infused with green cardamom, cloves, cinnamon, and fresh milk cream.',
    price: 50.0,
    unit: 'clay cup',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400',
  });

  await seedProduct(chaiOutlet.id, 'Crispy Bites', {
    name: 'Crispy Beef Samosas (3 pcs)',
    desc: 'Spicy minced beef filling with onions and mint inside ultra-crisp pastry wrappers.',
    price: 90.0,
    unit: '3 pcs',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',
  });

  console.log(`   ✅ Seeded ${allProducts.length} active menu items across Food, Grocery, Super Shop, and Pharmacy.\n`);

  // ===========================================================================
  // 5. PROMOTIONAL BANNERS & COUPONS
  // ===========================================================================
  console.log('🎨 [5/8] Seeding Interactive Carousel Banners & Discount Coupons...');

  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({
    data: [
      {
        title: '50% Off Your First Gourmet Burger',
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
        linkType: BannerLinkType.OUTLET,
        targetId: gulshanOutlet.id,
        sortOrder: 1,
        isActive: true,
      },
      {
        title: 'Royal Biryani Feast at Sultan Dine',
        imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800',
        linkType: BannerLinkType.OUTLET,
        targetId: sultansOutlet.id,
        sortOrder: 2,
        isActive: true,
      },
      {
        title: '20-Min Supermarket Delivery to Your Door',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
        linkType: BannerLinkType.OUTLET,
        targetId: dailyBazaarOutlet.id,
        sortOrder: 3,
        isActive: true,
      },
      {
        title: '24/7 Essential Medicine Delivery',
        imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800',
        linkType: BannerLinkType.OUTLET,
        targetId: medPlusOutlet.id,
        sortOrder: 4,
        isActive: true,
      },
    ],
  });

  const couponDefs = [
    {
      code: 'WELCOME50',
      desc: 'Get 50 BDT flat discount on your first order above 250 BDT',
      type: DiscountType.FLAT,
      val: 50.0,
      min: 250.0,
      max: null,
    },
    {
      code: 'BURGER20',
      desc: '20% off up to 100 BDT on Gourmet Burgers',
      type: DiscountType.PERCENTAGE,
      val: 20.0,
      min: 300.0,
      max: 100.0,
    },
    {
      code: 'FREEDEL',
      desc: 'Free delivery on all orders above 400 BDT',
      type: DiscountType.FLAT,
      val: 50.0,
      min: 400.0,
      max: null,
    },
    {
      code: 'PHARMA15',
      desc: '15% discount on prescription and wellness products',
      type: DiscountType.PERCENTAGE,
      val: 15.0,
      min: 500.0,
      max: 150.0,
    },
    {
      code: 'GROCERY10',
      desc: '10% off on fresh produce and daily grocery baskets',
      type: DiscountType.PERCENTAGE,
      val: 10.0,
      min: 350.0,
      max: 80.0,
    },
  ];

  const seededCoupons: { id: string; code: string }[] = [];
  for (const cp of couponDefs) {
    const coupon = await prisma.coupon.upsert({
      where: { code: cp.code },
      update: {
        discountType: cp.type,
        discountValue: cp.val,
        minOrderAmount: cp.min,
        maxDiscountAmount: cp.max,
        usageLimit: 1000,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: new Date('2027-12-31T23:59:59Z'),
        isActive: true,
      },
      create: {
        code: cp.code,
        description: cp.desc,
        discountType: cp.type,
        discountValue: cp.val,
        minOrderAmount: cp.min,
        maxDiscountAmount: cp.max,
        usageLimit: 1000,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: new Date('2027-12-31T23:59:59Z'),
        isActive: true,
      },
    });
    seededCoupons.push({ id: coupon.id, code: coupon.code });
  }
  console.log('   ✅ 4 Banners and 5 Active Coupons seeded.\n');

  // ===========================================================================
  // 6. MASSIVE ORDERS & DOUBLE-ENTRY LEDGERS (ALL LIFECYCLE STATES)
  // ===========================================================================
  console.log('📦 [6/8] Generating 100+ Orders across all lifecycle states and date horizons...');

  // Clean slate previous orders and ledgers to guarantee idempotency on multiple runs
  await prisma.orderItem.deleteMany({});
  await prisma.commissionLedger.deleteMany({});
  await prisma.riderTripLedger.deleteMany({});
  await prisma.order.deleteMany({});

  let orderSequence = 1000;
  function nextOrderNum(date: Date) {
    orderSequence++;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `ORD-${y}${m}${d}-${orderSequence}`;
  }

  // Active status groups to showcase the live boards
  // Live Kanban Lane 1: PLACED
  // Live Kanban Lane 2: PREPARING (with countdown)
  // Live Kanban Lane 3: READY_FOR_PICKUP
  // Dispatch Map: DISPATCHED (with rider coordinates)

  const activeOrdersConfig = [
    // --- PLACED (New incoming orders awaiting claim/accept) ---
    { vendor: gulshanOutlet, status: OrderStatus.PLACED, ageHours: 0.1, customerIndex: 0, items: [0, 3] },
    { vendor: gulshanOutlet, status: OrderStatus.PLACED, ageHours: 0.2, customerIndex: 1, items: [1] },
    { vendor: sultansOutlet, status: OrderStatus.PLACED, ageHours: 0.15, customerIndex: 2, items: [5, 7] },
    { vendor: pizzaOutlet, status: OrderStatus.PLACED, ageHours: 0.25, customerIndex: 3, items: [9] },
    { vendor: dailyBazaarOutlet, status: OrderStatus.PLACED, ageHours: 0.3, customerIndex: 4, items: [15, 17] },
    { vendor: medPlusOutlet, status: OrderStatus.PLACED, ageHours: 0.05, customerIndex: 5, items: [21] },

    // --- RIDER_ASSIGNED (Rider secured, awaiting kitchen acceptance) ---
    { vendor: gulshanOutlet, status: OrderStatus.RIDER_ASSIGNED, riderIndex: 0, ageHours: 0.35, customerIndex: 6, items: [0, 4] },
    { vendor: sultansOutlet, status: OrderStatus.RIDER_ASSIGNED, riderIndex: 1, ageHours: 0.4, customerIndex: 7, items: [5, 6] },
    { vendor: pizzaOutlet, status: OrderStatus.RIDER_ASSIGNED, riderIndex: 2, ageHours: 0.3, customerIndex: 8, items: [10, 11] },

    // --- ACCEPTED (Store confirmed, prep starting) ---
    { vendor: gulshanOutlet, status: OrderStatus.ACCEPTED, riderIndex: 4, ageHours: 0.5, customerIndex: 9, items: [1, 3] },
    { vendor: sweetBakeryOutlet, status: OrderStatus.ACCEPTED, riderIndex: 5, ageHours: 0.45, customerIndex: 10, items: [12, 14] },

    // --- PREPARING (In kitchen with active timers in Kanban lane 2) ---
    { vendor: gulshanOutlet, status: OrderStatus.PREPARING, riderIndex: 0, ageHours: 0.6, customerIndex: 11, items: [0, 2], prepTime: 20 },
    { vendor: gulshanOutlet, status: OrderStatus.PREPARING, riderIndex: 4, ageHours: 0.7, customerIndex: 12, items: [1, 3], prepTime: 15 },
    { vendor: sultansOutlet, status: OrderStatus.PREPARING, riderIndex: 1, ageHours: 0.65, customerIndex: 13, items: [5, 7, 8], prepTime: 25 },
    { vendor: pizzaOutlet, status: OrderStatus.PREPARING, riderIndex: 2, ageHours: 0.8, customerIndex: 14, items: [9, 11], prepTime: 20 },
    { vendor: medPlusOutlet, status: OrderStatus.PREPARING, riderIndex: 6, ageHours: 0.4, customerIndex: 15, items: [21, 22], prepTime: 10 },

    // --- READY_FOR_PICKUP (Waiting for rider at store counter in Kanban lane 3) ---
    { vendor: gulshanOutlet, status: OrderStatus.READY_FOR_PICKUP, riderIndex: 0, ageHours: 0.9, customerIndex: 16, items: [0, 3] },
    { vendor: sultansOutlet, status: OrderStatus.READY_FOR_PICKUP, riderIndex: 6, ageHours: 0.95, customerIndex: 17, items: [5, 6] },
    { vendor: pizzaOutlet, status: OrderStatus.READY_FOR_PICKUP, riderIndex: 7, ageHours: 0.85, customerIndex: 18, items: [9] },

    // --- DISPATCHED (Out on the road with live tracking on Admin Dispatch Map) ---
    { vendor: gulshanOutlet, status: OrderStatus.DISPATCHED, riderIndex: 1, ageHours: 1.1, customerIndex: 0, items: [0, 1] },
    { vendor: sultansOutlet, status: OrderStatus.DISPATCHED, riderIndex: 7, ageHours: 1.2, customerIndex: 1, items: [5, 7] },
    { vendor: pizzaOutlet, status: OrderStatus.DISPATCHED, riderIndex: 8, ageHours: 1.0, customerIndex: 2, items: [10] },
    { vendor: dailyBazaarOutlet, status: OrderStatus.DISPATCHED, riderIndex: 9, ageHours: 1.3, customerIndex: 3, items: [15, 16, 17] },
  ];

  let totalDeliveredCreated = 0;
  let totalActiveCreated = 0;
  let totalCancelledCreated = 0;

  // Create Active Orders
  for (const cfg of activeOrdersConfig) {
    const cust = seededCustomers[cfg.customerIndex % seededCustomers.length];
    const rider = cfg.riderIndex !== undefined ? seededRiders[cfg.riderIndex % seededRiders.length] : null;
    const placedDate = hoursAgo(cfg.ageHours);
    const orderNum = nextOrderNum(placedDate);

    // Pick items from available products
    const selectedProds = cfg.items.map((idx) => allProducts[idx % allProducts.length]);
    let subtotal = 0;
    const orderItemPayloads = selectedProds.map((p) => {
      const qty = 1;
      const total = p.basePrice * qty;
      subtotal += total;
      return {
        productId: p.id,
        productNameSnapshot: p.name,
        unitPrice: p.basePrice,
        quantity: qty,
        totalPrice: total,
      };
    });

    const deliveryFee = 50.0;
    const totalAmount = subtotal + deliveryFee;

    await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerId: cust.id,
        vendorId: cfg.vendor.id,
        riderId: rider ? rider.id : null,
        status: cfg.status,
        subtotal: subtotal,
        couponDiscount: 0.0,
        deliveryFee: deliveryFee,
        taxAmount: 0.0,
        totalAmount: totalAmount,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.PENDING,
        deliveryAddressSnapshot: cust.addressSnapshot,
        customerPhoneSnapshot: cust.phone,
        prepTimeMinutes: cfg.prepTime || cfg.vendor.defaultPrepTimeMinutes,
        customerNotes: 'Please ring the doorbell when arriving.',
        placedAt: placedDate,
        acceptedAt: cfg.status !== OrderStatus.PLACED && cfg.status !== OrderStatus.RIDER_ASSIGNED ? hoursAgo(cfg.ageHours - 0.1) : null,
        pickedUpAt: cfg.status === OrderStatus.DISPATCHED ? hoursAgo(cfg.ageHours - 0.3) : null,
        orderItems: {
          create: orderItemPayloads,
        },
      },
    });
    totalActiveCreated++;
  }

  // Create 75+ Historical DELIVERED Orders across 30 Days (for charts, GMV, volume, ledgers)
  console.log('   Generating historical completed orders with double-entry ledgers...');
  const daysHistory = 30;
  for (let day = 0; day < daysHistory; day++) {
    // Generate 2 to 4 completed orders per day
    const ordersThisDay = day < 7 ? 4 : 2;

    for (let o = 0; o < ordersThisDay; o++) {
      const hourShift = Math.floor(Math.random() * 12) + 10; // 10 AM to 10 PM
      const orderDate = daysAgo(day, hourShift);
      const orderNum = nextOrderNum(orderDate);

      const cust = seededCustomers[(day * 3 + o) % seededCustomers.length];
      const vendor = allVendors[(day + o) % allVendors.length];
      const rider = seededRiders[(day * 2 + o) % seededRiders.length];

      // Select 1 to 3 items from vendor or global product pool
      const vendorProds = allProducts.filter((p) => p.vendorId === vendor.id);
      const chosenProds = vendorProds.length > 0 ? vendorProds : allProducts.slice(0, 3);
      const item1 = chosenProds[o % chosenProds.length];
      const item2 = chosenProds[(o + 1) % chosenProds.length];

      let subtotal = item1.basePrice;
      const orderItemPayloads = [
        {
          productId: item1.id,
          productNameSnapshot: item1.name,
          unitPrice: item1.basePrice,
          quantity: 1,
          totalPrice: item1.basePrice,
        },
      ];

      if (o % 2 === 1 && item2) {
        subtotal += item2.basePrice;
        orderItemPayloads.push({
          productId: item2.id,
          productNameSnapshot: item2.name,
          unitPrice: item2.basePrice,
          quantity: 1,
          totalPrice: item2.basePrice,
        });
      }

      // Optional coupon
      let couponId: string | null = null;
      let couponDiscount = 0.0;
      if (day % 3 === 0 && subtotal >= 250) {
        couponId = seededCoupons[0].id; // WELCOME50
        couponDiscount = 50.0;
      }

      const deliveryFee = 50.0;
      const totalAmount = subtotal - couponDiscount + deliveryFee;
      const isOnline = (day + o) % 3 === 0;
      const paymentMethod = isOnline ? PaymentMethod.ONLINE_GATEWAY : PaymentMethod.CASH_ON_DELIVERY;

      // Calculate exact double-entry ledger figures
      const grossAmount = subtotal - couponDiscount;
      const commissionRate = Number(vendor.commissionRate);
      const commissionAmount = Math.round(grossAmount * (commissionRate / 100) * 100) / 100;
      const netVendorPayable = Math.round((grossAmount - commissionAmount) * 100) / 100;
      const deliveryEarnings = 50.0;
      const codCollected = isOnline ? 0.0 : totalAmount;

      const settlementStatus = day > 7 ? SettlementStatus.SETTLED : day > 2 ? SettlementStatus.PROCESSING : SettlementStatus.PENDING;

      const createdOrder = await prisma.order.create({
        data: {
          orderNumber: orderNum,
          customerId: cust.id,
          vendorId: vendor.id,
          riderId: rider.id,
          couponId: couponId,
          status: OrderStatus.DELIVERED,
          subtotal: subtotal,
          couponDiscount: couponDiscount,
          deliveryFee: deliveryFee,
          taxAmount: 0.0,
          totalAmount: totalAmount,
          paymentMethod: paymentMethod,
          paymentStatus: PaymentStatus.PAID,
          deliveryAddressSnapshot: cust.addressSnapshot,
          customerPhoneSnapshot: cust.phone,
          prepTimeMinutes: vendor.defaultPrepTimeMinutes,
          customerNotes: 'Contactless delivery requested.',
          placedAt: orderDate,
          acceptedAt: new Date(orderDate.getTime() + 5 * 60000),
          pickedUpAt: new Date(orderDate.getTime() + 25 * 60000),
          deliveredAt: new Date(orderDate.getTime() + 45 * 60000),
          orderItems: {
            create: orderItemPayloads,
          },
          commission: {
            create: {
              vendorId: vendor.id,
              grossAmount: grossAmount,
              commissionRate: commissionRate,
              commissionAmount: commissionAmount,
              netVendorPayable: netVendorPayable,
              settlementStatus: settlementStatus,
              settledAt: settlementStatus === SettlementStatus.SETTLED ? new Date(orderDate.getTime() + 86400000 * 3) : null,
              createdAt: orderDate,
            },
          },
          riderTrip: {
            create: {
              riderId: rider.id,
              deliveryEarnings: deliveryEarnings,
              codCollected: codCollected,
              status: settlementStatus,
              createdAt: orderDate,
            },
          },
        },
      });

      totalDeliveredCreated++;
    }
  }

  // Create 6 CANCELLED Orders with realistic reasons
  const cancelReasons = [
    'Customer requested cancellation before restaurant acceptance.',
    'Customer placed duplicate order by mistake.',
    'Item out of stock at the merchant outlet.',
    'Customer address unreachable by delivery fleet.',
    'Order cancelled due to prolonged delay during heavy monsoon rain.',
    'Payment gateway authorization failed after multiple attempts.',
  ];

  for (let c = 0; c < cancelReasons.length; c++) {
    const cancelDate = daysAgo(c * 2 + 1, 4);
    const orderNum = nextOrderNum(cancelDate);
    const cust = seededCustomers[c % seededCustomers.length];
    const vendor = allVendors[c % allVendors.length];
    const prod = allProducts[c % allProducts.length];

    await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerId: cust.id,
        vendorId: vendor.id,
        status: OrderStatus.CANCELLED,
        subtotal: prod.basePrice,
        couponDiscount: 0.0,
        deliveryFee: 50.0,
        taxAmount: 0.0,
        totalAmount: prod.basePrice + 50.0,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.FAILED,
        deliveryAddressSnapshot: cust.addressSnapshot,
        customerPhoneSnapshot: cust.phone,
        rejectionReason: cancelReasons[c],
        placedAt: cancelDate,
        cancelledAt: new Date(cancelDate.getTime() + 8 * 60000),
        orderItems: {
          create: [
            {
              productId: prod.id,
              productNameSnapshot: prod.name,
              unitPrice: prod.basePrice,
              quantity: 1,
              totalPrice: prod.basePrice,
            },
          ],
        },
      },
    });
    totalCancelledCreated++;
  }

  console.log(`   ✅ Created ${totalActiveCreated} active orders, ${totalDeliveredCreated} completed historical orders, and ${totalCancelledCreated} cancelled orders.\n`);

  // ===========================================================================
  // 7. VERIFICATION & SUMMARY
  // ===========================================================================
  const totalUsers = await prisma.user.count();
  const totalRiders = await prisma.rider.count();
  const totalVendors = await prisma.vendor.count();
  const totalProds = await prisma.product.count();
  const totalOrders = await prisma.order.count();
  const totalCommissions = await prisma.commissionLedger.count();
  const totalRiderTrips = await prisma.riderTripLedger.count();

  const totalGmvResult = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { status: OrderStatus.DELIVERED },
  });

  console.log('========================================================================');
  console.log('🎉 MASSIVE DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');
  console.log(`👤 Total Users:             ${totalUsers} (Admins, Managers, Riders, Customers)`);
  console.log(`🛵 Total Active Riders:      ${totalRiders} across Dhaka`);
  console.log(`🏪 Outlets Active:          ${totalVendors} (Food, Grocery, Super Shop, Pharmacy)`);
  console.log(`🍔 Products & Items:        ${totalProds} with variants`);
  console.log(`📦 Total Orders:            ${totalOrders} across all 8 lifecycle states`);
  console.log(`💰 Delivered GMV Volume:    ৳ ${totalGmvResult._sum.totalAmount?.toLocaleString()} BDT`);
  console.log(`📑 Commission Ledgers:      ${totalCommissions} double-entry balanced`);
  console.log(`🛵 Rider Trip Ledgers:      ${totalRiderTrips} settlement verified`);
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Massive Seeder Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
