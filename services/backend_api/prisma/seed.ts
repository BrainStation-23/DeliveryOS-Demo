import { PrismaClient, UserRole, AccountStatus, VendorVertical, PermissionScope, DiscountType, BannerLinkType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DeliveryOS Comprehensive Database Seeder...\n');

  // ---------------------------------------------------------------------------
  // 1. System Settings
  // ---------------------------------------------------------------------------
  console.log('⚙️  Seeding System Settings...');
  await prisma.systemSetting.upsert({
    where: { key: 'order_flow_config' },
    update: {
      value: {
        mode: 'RIDER_FIRST',
        rider_search_timeout_seconds: 90,
        description: 'Zero Food Waste Mode: Secures rider before kitchen begins prep.'
      }
    },
    create: {
      key: 'order_flow_config',
      value: {
        mode: 'RIDER_FIRST',
        rider_search_timeout_seconds: 90,
        description: 'Zero Food Waste Mode: Secures rider before kitchen begins prep.'
      },
      description: 'Order fulfillment flow sequence (RIDER_FIRST vs VENDOR_FIRST)'
    }
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
    where: { key: 'delivery_economics' },
    update: {
      value: {
        rider_share_percent: 80,
        eta_avg_speed_kmh: 25,
        eta_fallback_minutes: 10
      },
      description: 'Platform delivery economics and speed configuration'
    },
    create: {
      key: 'delivery_economics',
      value: {
        rider_share_percent: 80,
        eta_avg_speed_kmh: 25,
        eta_fallback_minutes: 10
      },
      description: 'Platform delivery economics and speed configuration'
    }
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
            tax_percentage: 0.0
          },
          KSA: {
            currency: 'SAR',
            currency_symbol: '﷼',
            default_locale: 'ar',
            phone_prefix: '+966',
            tax_percentage: 15.0
          }
        }
      }
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
            tax_percentage: 0.0
          },
          KSA: {
            currency: 'SAR',
            currency_symbol: '﷼',
            default_locale: 'ar',
            phone_prefix: '+966',
            tax_percentage: 15.0
          }
        }
      },
      description: 'Regional currency, prefix, and taxation parameters'
    }
  });
  console.log('   ✅ System settings seeded.\n');

  // ---------------------------------------------------------------------------
  // 2. Core Users (All 4 Stakeholders)
  // ---------------------------------------------------------------------------
  console.log('👥 Seeding Core Users...');
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+8801700000001' },
    update: { fullName: 'DeliveryOS Super Admin', role: UserRole.SUPER_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000001',
      fullName: 'DeliveryOS Super Admin',
      email: 'admin@deliveryos.local',
      role: UserRole.SUPER_ADMIN,
      status: AccountStatus.ACTIVE
    }
  });

  const branchManager = await prisma.user.upsert({
    where: { phone: '+8801700000002' },
    update: { fullName: 'Rahim Uddin (Branch Manager)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000002',
      fullName: 'Rahim Uddin (Branch Manager)',
      email: 'rahim.manager@burgerpoint.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE
    }
  });

  const brandOwner = await prisma.user.upsert({
    where: { phone: '+8801700000003' },
    update: { fullName: 'Karim Chowdhury (Brand Owner)', role: UserRole.VENDOR_ADMIN, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000003',
      fullName: 'Karim Chowdhury (Brand Owner)',
      email: 'karim.owner@burgerpoint.local',
      role: UserRole.VENDOR_ADMIN,
      status: AccountStatus.ACTIVE
    }
  });

  const riderUser = await prisma.user.upsert({
    where: { phone: '+8801700000004' },
    update: { fullName: 'Tanvir Hasan (Rider)', role: UserRole.RIDER, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000004',
      fullName: 'Tanvir Hasan (Rider)',
      email: 'tanvir.rider@deliveryos.local',
      role: UserRole.RIDER,
      status: AccountStatus.ACTIVE
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { phone: '+8801700000005' },
    update: { fullName: 'Sultana Razia (Customer)', role: UserRole.CUSTOMER, status: AccountStatus.ACTIVE },
    create: {
      phone: '+8801700000005',
      fullName: 'Sultana Razia (Customer)',
      email: 'sultana.customer@gmail.com',
      role: UserRole.CUSTOMER,
      status: AccountStatus.ACTIVE
    }
  });

  // Seed Customer Address
  await prisma.customerAddress.deleteMany({ where: { userId: customerUser.id } });
  await prisma.customerAddress.create({
    data: {
      userId: customerUser.id,
      label: 'Home',
      addressLine: 'House 42, Road 11, Banani, Dhaka',
      buildingFloor: 'Apartment 4B, 4th Floor',
      deliveryNote: 'Call on reaching the security gate',
      latitude: 23.7937,
      longitude: 90.4043,
      isDefault: true
    }
  });

  // Seed Rider Profile
  await prisma.rider.upsert({
    where: { userId: riderUser.id },
    update: {
      vehicleType: 'motorcycle',
      isOnline: true,
      cashInHand: 0.00,
      maxCashLimit: 5000.00,
      latitude: 23.7925,
      longitude: 90.4078
    },
    create: {
      userId: riderUser.id,
      vehicleType: 'motorcycle',
      isOnline: true,
      cashInHand: 0.00,
      maxCashLimit: 5000.00,
      latitude: 23.7925,
      longitude: 90.4078
    }
  });
  console.log('   ✅ Core users (Admin, Branch Manager, Brand Owner, Rider, Customer) seeded.\n');

  // ---------------------------------------------------------------------------
  // 3. Vendor Brands & Multi-Branch Outlets
  // ---------------------------------------------------------------------------
  console.log('🏪 Seeding Brands & Outlets...');
  // Brand 1: Burger Point
  let burgerBrand = await prisma.vendorBrand.findFirst({ where: { name: 'Burger Point' } });
  if (!burgerBrand) {
    burgerBrand = await prisma.vendorBrand.create({
      data: {
        name: 'Burger Point',
        logoUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200'
      }
    });
  }

  // Outlet 1: Gulshan Branch
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
        commissionRate: 15.00,
        deliveryRadiusKm: 5.00,
        defaultPrepTimeMinutes: 20,
        isActive: true
      }
    });
  }

  // Outlet 2: Dhanmondi Branch
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
        commissionRate: 15.00,
        deliveryRadiusKm: 4.50,
        defaultPrepTimeMinutes: 25,
        isActive: true
      }
    });
  }

  // Brand 2: FreshMart Super Shop
  let freshMartBrand = await prisma.vendorBrand.findFirst({ where: { name: 'FreshMart Daily Super Shop' } });
  if (!freshMartBrand) {
    freshMartBrand = await prisma.vendorBrand.create({
      data: {
        name: 'FreshMart Daily Super Shop',
        logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200'
      }
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
        commissionRate: 10.00,
        deliveryRadiusKm: 6.00,
        defaultPrepTimeMinutes: 15,
        isActive: true
      }
    });
  }

  // Assign 2-Tier Permissions
  await prisma.vendorStaff.deleteMany({ where: { userId: branchManager.id } });
  await prisma.vendorStaff.create({
    data: {
      userId: branchManager.id,
      vendorId: gulshanOutlet.id,
      brandId: burgerBrand.id,
      scope: PermissionScope.PARTICULAR_OUTLET
    }
  });

  await prisma.vendorStaff.deleteMany({ where: { userId: brandOwner.id } });
  await prisma.vendorStaff.create({
    data: {
      userId: brandOwner.id,
      brandId: burgerBrand.id,
      scope: PermissionScope.ALL_OUTLETS_MASTER
    }
  });

  // Operating Hours (All days open 09:00 - 23:00)
  const outlets = [gulshanOutlet, dhanmondiOutlet, freshMartOutlet];
  for (const outlet of outlets) {
    for (let day = 0; day <= 6; day++) {
      await prisma.vendorOperatingHour.upsert({
        where: { vendorId_dayOfWeek: { vendorId: outlet.id, dayOfWeek: day } },
        update: { openTime: '09:00:00', closeTime: '23:00:00', isClosed: false },
        create: { vendorId: outlet.id, dayOfWeek: day, openTime: '09:00:00', closeTime: '23:00:00', isClosed: false }
      });
    }
  }
  console.log('   ✅ Brands, 3 Outlets, Operating Hours, and 2-Tier Permissions seeded.\n');

  // ---------------------------------------------------------------------------
  // 4. Catalog: Categories, Products, Variants & Addons
  // ---------------------------------------------------------------------------
  console.log('🍔 Seeding Menus & Products...');
  // Categories for Gulshan Burger Point
  const burgerCat = await prisma.category.create({
    data: {
      vendorId: gulshanOutlet.id,
      name: 'Gourmet Burgers',
      sortOrder: 1,
      isActive: true
    }
  });

  const sidesCat = await prisma.category.create({
    data: {
      vendorId: gulshanOutlet.id,
      name: 'Crispy Sides & Fries',
      sortOrder: 2,
      isActive: true
    }
  });

  // Product 1: Classic Smoky Beef Burger (With Variants & Addons)
  const beefBurger = await prisma.product.create({
    data: {
      vendorId: gulshanOutlet.id,
      categoryId: burgerCat.id,
      name: 'Classic Smoky Beef Burger',
      description: 'Flame-grilled 150g beef patty with melted cheddar, smoked caramelized onions, and house barbecue sauce.',
      basePrice: 320.00,
      unitType: 'piece',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
      isInStock: true,
      sortOrder: 1
    }
  });

  // Variants for Beef Burger
  await prisma.productVariant.createMany({
    data: [
      { productId: beefBurger.id, name: 'Single Patty (150g)', price: 320.00, sortOrder: 1, isInStock: true },
      { productId: beefBurger.id, name: 'Double Patty (300g)', price: 440.00, sortOrder: 2, isInStock: true },
      { productId: beefBurger.id, name: 'Triple Monster (450g)', price: 540.00, sortOrder: 3, isInStock: true }
    ]
  });

  // Product 2: Peri-Peri Crispy Chicken Burger
  const chickenBurger = await prisma.product.create({
    data: {
      vendorId: gulshanOutlet.id,
      categoryId: burgerCat.id,
      name: 'Peri-Peri Crispy Chicken Burger',
      description: 'Crispy fried chicken breast fillet tossed in spicy peri-peri seasoning with fresh iceberg lettuce.',
      basePrice: 280.00,
      unitType: 'piece',
      imageUrl: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400',
      isInStock: true,
      sortOrder: 2
    }
  });

  await prisma.productVariant.createMany({
    data: [
      { productId: chickenBurger.id, name: 'Regular Zesty', price: 280.00, sortOrder: 1, isInStock: true },
      { productId: chickenBurger.id, name: 'Extra Fiery Hot', price: 300.00, sortOrder: 2, isInStock: true }
    ]
  });

  // Product 3: Seasoned French Fries
  await prisma.product.create({
    data: {
      vendorId: gulshanOutlet.id,
      categoryId: sidesCat.id,
      name: 'Seasoned French Fries',
      description: 'Golden skin-on potato fries tossed in rosemary garlic sea salt.',
      basePrice: 120.00,
      unitType: 'pack',
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400',
      isInStock: true,
      sortOrder: 3
    }
  });

  // Categories & Products for FreshMart Super Shop
  const groceryCat = await prisma.category.create({
    data: {
      vendorId: freshMartOutlet.id,
      name: 'Fresh Farm Produce',
      sortOrder: 1,
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      vendorId: freshMartOutlet.id,
      categoryId: groceryCat.id,
      name: 'Fresh Cavendish Bananas',
      description: 'Naturally ripened, premium sweet bananas from regional farms.',
      basePrice: 90.00,
      unitType: 'dozen',
      imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
      isInStock: true,
      sortOrder: 1
    }
  });

  await prisma.product.create({
    data: {
      vendorId: freshMartOutlet.id,
      categoryId: groceryCat.id,
      name: 'Organic Red Tomatoes',
      description: 'Fresh greenhouse-grown red tomatoes, firm and juicy.',
      basePrice: 70.00,
      unitType: 'kg',
      imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
      isInStock: true,
      sortOrder: 2
    }
  });
  console.log('   ✅ Categories, Products, and Variants seeded.\n');

  // ---------------------------------------------------------------------------
  // 5. Promotional Banners
  // ---------------------------------------------------------------------------
  console.log('🎨 Seeding Promotional Banners...');
  await prisma.banner.deleteMany({});
  await prisma.banner.create({
    data: {
      title: '50% Off Your First Gourmet Burger',
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
      linkType: BannerLinkType.OUTLET,
      targetId: gulshanOutlet.id,
      sortOrder: 1,
      isActive: true
    }
  });

  await prisma.banner.create({
    data: {
      title: 'Daily Supermarket Essentials Delivered in 20 Mins',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
      linkType: BannerLinkType.OUTLET,
      targetId: freshMartOutlet.id,
      sortOrder: 2,
      isActive: true
    }
  });
  console.log('   ✅ 2 Promotional Banners seeded.\n');

  // ---------------------------------------------------------------------------
  // 6. Promotional Coupons
  // ---------------------------------------------------------------------------
  console.log('🏷️  Seeding Promotional Coupons...');
  await prisma.coupon.upsert({
    where: { code: 'WELCOME50' },
    update: {
      discountType: DiscountType.FLAT,
      discountValue: 50.00,
      minOrderAmount: 250.00,
      usageLimit: 1000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: new Date('2027-12-31T23:59:59Z'),
      isActive: true
    },
    create: {
      code: 'WELCOME50',
      description: 'Get 50 BDT flat discount on your first order above 250 BDT',
      discountType: DiscountType.FLAT,
      discountValue: 50.00,
      minOrderAmount: 250.00,
      usageLimit: 1000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: new Date('2027-12-31T23:59:59Z'),
      isActive: true
    }
  });

  await prisma.coupon.upsert({
    where: { code: 'BURGER20' },
    update: {
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20.00,
      minOrderAmount: 300.00,
      maxDiscountAmount: 100.00,
      usageLimit: 500,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: new Date('2027-12-31T23:59:59Z'),
      isActive: true
    },
    create: {
      code: 'BURGER20',
      description: '20% off up to 100 BDT on Gourmet Burgers',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20.00,
      minOrderAmount: 300.00,
      maxDiscountAmount: 100.00,
      usageLimit: 500,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: new Date('2027-12-31T23:59:59Z'),
      isActive: true
    }
  });
  console.log('   ✅ Coupons WELCOME50 and BURGER20 seeded.\n');

  console.log('========================================================================');
  console.log('🎉 Database seeding completed successfully! All entities verified.');
  console.log('========================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Seeder Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
