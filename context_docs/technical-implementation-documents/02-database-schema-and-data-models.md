# 02 — Database Schema & Data Models

Relational entity relationships, data dictionary, PostgreSQL 16 DDL with PostGIS spatial extensions, performance indexes, and spatial query specifications for DeliveryOS.

---

## 1. Relational Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ CUSTOMER_ADDRESSES : has
    USERS ||--o| RIDERS : profile
    USERS ||--o{ VENDOR_STAFF : assigned_to

    VENDOR_BRANDS ||--o{ VENDORS : owns
    VENDORS ||--o{ VENDOR_STAFF : employs
    VENDORS ||--o{ VENDOR_OPERATING_HOURS : schedules
    VENDORS ||--o{ CATEGORIES : owns
    CATEGORIES ||--o{ PRODUCTS : contains
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCTS ||--o{ PRODUCT_ADDON_GROUPS : configures
    PRODUCT_ADDON_GROUPS ||--o{ PRODUCT_ADDONS : includes

    VENDORS ||--o{ ORDERS : receives
    USERS ||--o{ ORDERS : places
    RIDERS ||--o{ ORDERS : delivers
    COUPONS ||--o{ ORDERS : applies_to
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : initiates
    RIDERS ||--o{ CASH_DEPOSITS : submits

    ORDERS ||--o| COMMISSION_LEDGERS : generates
    ORDERS ||--o| RIDER_TRIP_LEDGERS : tracks
    SETTLEMENT_BATCHES ||--o{ COMMISSION_LEDGERS : groups
    SETTLEMENT_BATCHES ||--o{ RIDER_TRIP_LEDGERS : groups

    BANNERS }o--o| VENDORS : links_to
    BANNERS }o--o| CATEGORIES : links_to

    USERS ||--o{ MEDIA_ASSETS : uploads
```

---

## 2. Granular Data Entities Catalog

1. **`users`**: Platform user accounts across all roles (`SUPER_ADMIN`, `VENDOR_ADMIN`, `RIDER`, `CUSTOMER`). Contains phone, name, email, account status, and FCM device tokens.
2. **`customer_addresses`**: Geocoded delivery locations linked to users. Contains label (`Home`, `Work`, `Other`), address details, and `latitude`/`longitude` float coordinates (PostGIS geography computed at query time).
3. **`vendor_brands`**: Top-level merchant brand entities for multi-branch chains.
4. **`vendors`**: Physical merchant outlets. Stores `latitude`/`longitude` coordinates, commission rate, delivery radius (km), operational status, and default prep time.
5. **`vendor_staff`**: Junction table binding users to outlets or brands with permission scopes (`PARTICULAR_OUTLET` vs `ALL_OUTLETS_MASTER`).
6. **`vendor_operating_hours`**: Weekly 7-day schedule (0=Sun to 6=Sat) with open/close times and closed checkboxes.
7. **`categories`**: Menu categories scoped to a vendor or global (NULL vendor_id).
8. **`products`**: Menu items with base price, description, unit type (`piece`, `kg`, etc.), and stock availability flag.
9. **`product_variants`**: Single-choice variants (e.g. sizes, weights) with additive price modifiers.
10. **`product_addon_groups`**: Add-on groups (e.g. sauces, toppings) with min/max selection bounds.
11. **`product_addons`**: Individual selectable add-on items with specific pricing.
12. **`banners`**: Promotional homepage hero banners with active scheduling and target deep links.
13. **`coupons`**: Discount promo codes with flat or percentage values, spend thresholds, ceilings, and usage limits.
14. **`riders`**: Delivery courier profiles linked to users. Stores vehicle type, online duty state, approval state, cash-in-hand balance, max cash safety limit, and last known `latitude`/`longitude`.
15. **`system_settings`**: Global platform configuration keys (JSONB) for fee pricing mode, FSM mode, and currency parameters.
16. **`orders`**: Master order record containing order number, snapshots of address and customer phone, status FSM, line item totals, timestamps, and notes.
17. **`order_items`**: Line items within an order with snapshots of product name, unit price, quantity, variant, and add-ons.
18. **`settlement_batches`**: Weekly administrative financial payout cycles grouping completed orders.
19. **`commission_ledgers`**: Double-entry ledger recording gross food totals, platform commission deductions, and net vendor payables per order.
20. **`rider_trip_ledgers`**: Ledger tracking courier trip earnings and doorstep COD collections per order.
21. **`cash_deposits`**: Audit records of physical cash deposits made by couriers at central hubs.
22. **`payments`**: Transaction records for online payment gateway sessions (SSLCommerz, Sandbox) and cryptographic webhooks.

---

## 3. Production PostgreSQL DDL & Spatial Schema

> **Source of truth**: `services/backend_api/prisma/schema.prisma` + `prisma/migrations/`. The DDL below is the logical reference model. Coordinates persist as `DOUBLE PRECISION` lat/lng pairs; PostGIS geography is expressed at query time over `GIST` expression indexes.

```sql
-- 1. Initialize Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Enumerated Types (managed by Prisma)
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'VENDOR_ADMIN', 'RIDER', 'CUSTOMER');
CREATE TYPE account_status AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE vendor_vertical AS ENUM ('FOOD', 'GROCERY', 'SUPER_SHOP', 'PHARMACY');
CREATE TYPE permission_scope AS ENUM ('PARTICULAR_OUTLET', 'ALL_OUTLETS_MASTER');
CREATE TYPE order_status AS ENUM (
  'PLACED', 
  'RIDER_ASSIGNED',
  'ACCEPTED', -- Deprecated runtime legacy state: transitions directly to PREPARING (ADR-002)
  'PREPARING', 
  'READY_FOR_PICKUP', 
  'DISPATCHED', 
  'DELIVERED', 
  'CANCELLED'
);
CREATE TYPE payment_method AS ENUM ('CASH_ON_DELIVERY', 'ONLINE_GATEWAY');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');
CREATE TYPE settlement_status AS ENUM ('PENDING', 'PROCESSING', 'SETTLED');
CREATE TYPE delivery_fee_mode AS ENUM ('FIXED_FLAT', 'DISTANCE_TIERED');
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FLAT');
CREATE TYPE banner_link_type AS ENUM ('OUTLET', 'CATEGORY', 'EXTERNAL');
-- Note: dispatch flow mode (`RIDER_FIRST`/`VENDOR_FIRST`) and delivery-fee config live in the
-- `system_settings` JSONB keys `order_flow_config` / `delivery_fee_config`, not SQL enums.
-- Cash-deposit status is a VARCHAR convention: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'.

-- 3. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    status account_status NOT NULL DEFAULT 'ACTIVE',
    fcm_token TEXT,
    device_platform VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customer Addresses Table (Float Coordinates + Expression GIST)
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(30) NOT NULL DEFAULT 'Home',
    address_line TEXT NOT NULL,
    building_floor VARCHAR(100),
    delivery_note TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customer_addresses_geo ON customer_addresses USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
CREATE INDEX idx_customer_addresses_user_id ON customer_addresses(user_id);

-- 5. Vendor Brands Table (For Multi-Outlet Chains)
CREATE TABLE vendor_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Vendors / Outlets Table (Float Coordinates + Expression GIST & Radius)
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES vendor_brands(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    vertical vendor_vertical NOT NULL DEFAULT 'FOOD',
    contact_phone VARCHAR(20) NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address_text TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    delivery_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    default_prep_time_minutes INT NOT NULL DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    is_busy BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vendors_geo ON vendors USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
CREATE INDEX idx_vendors_brand_id ON vendors(brand_id);
CREATE INDEX idx_vendors_is_active ON vendors(is_active);

-- 7. Vendor Staff & Permission Scopes
CREATE TABLE vendor_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES vendor_brands(id) ON DELETE CASCADE,
    scope permission_scope NOT NULL DEFAULT 'PARTICULAR_OUTLET',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, vendor_id)
);
CREATE INDEX idx_vendor_staff_user_id ON vendor_staff(user_id);

-- 8. Vendor Operating Hours Table
CREATE TABLE vendor_operating_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    UNIQUE(vendor_id, day_of_week)
);
CREATE INDEX idx_vendor_operating_hours_vendor ON vendor_operating_hours(vendor_id);

-- 9. Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_categories_vendor_id ON categories(vendor_id);

-- 10. Products / Items Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    unit_type VARCHAR(20) DEFAULT 'piece',
    image_url TEXT,
    is_in_stock BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_category ON products(category_id);

-- 11. Product Variants Table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_modifier NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_in_stock BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);

-- 12. Product Add-on Groups & Addons
CREATE TABLE product_addon_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    min_selection INT DEFAULT 0,
    max_selection INT DEFAULT 5
);
CREATE INDEX idx_product_addon_groups_product ON product_addon_groups(product_id);

CREATE TABLE product_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    addon_group_id UUID NOT NULL REFERENCES product_addon_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_in_stock BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_product_addons_group ON product_addons(addon_group_id);

-- 13. Promotional Banners Table
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    image_url TEXT NOT NULL,
    link_type banner_link_type NOT NULL DEFAULT 'OUTLET',
    target_id VARCHAR(100),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_banners_is_active ON banners(is_active);

-- 14. Promotional Coupons Table
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL DEFAULT 'PERCENTAGE',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) DEFAULT 0.00,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INT DEFAULT 1000,
    current_uses INT DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_coupons_code ON coupons(code);

-- 15. Riders Table
CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'motorcycle',
    is_online BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    cash_in_hand NUMERIC(10, 2) DEFAULT 0.00,
    max_cash_limit NUMERIC(10, 2) DEFAULT 5000.00,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_riders_geo ON riders USING GIST (CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography));
CREATE INDEX idx_riders_is_online ON riders(is_online);
CREATE INDEX idx_riders_is_approved ON riders(is_approved);

-- 16. System Settings Table
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES users(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    rider_id UUID REFERENCES riders(id),
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'PLACED',
    
    subtotal NUMERIC(10, 2) NOT NULL,
    coupon_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    
    payment_method payment_method NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    
    delivery_address_snapshot JSONB NOT NULL,
    customer_phone_snapshot VARCHAR(20) NOT NULL,
    
    prep_time_minutes INT,
    customer_notes TEXT,
    rejection_reason TEXT,
    
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_vendor_status ON orders(vendor_id, status);
CREATE INDEX idx_orders_placed_at ON orders(placed_at);

-- 18. Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name_snapshot VARCHAR(150) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10, 2) NOT NULL,
    variant_snapshot JSONB,
    addons_snapshot JSONB
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- 19. Settlement Batches Table
CREATE TABLE settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(30) UNIQUE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_orders INT NOT NULL,
    total_vendor_payout NUMERIC(12, 2) NOT NULL,
    total_rider_payout NUMERIC(12, 2) NOT NULL,
    total_platform_margin NUMERIC(12, 2) NOT NULL,
    status settlement_status NOT NULL DEFAULT 'SETTLED',
    executed_by_user_id UUID REFERENCES users(id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_settlement_batches_number ON settlement_batches(batch_number);

-- 20. Financial Ledgers
CREATE TABLE commission_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    settlement_batch_id UUID REFERENCES settlement_batches(id),
    gross_amount NUMERIC(10, 2) NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    net_vendor_payable NUMERIC(10, 2) NOT NULL,
    settlement_status settlement_status NOT NULL DEFAULT 'PENDING',
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_commission_vendor ON commission_ledgers(vendor_id);
CREATE INDEX idx_commission_settlement_batch ON commission_ledgers(settlement_batch_id);

CREATE TABLE rider_trip_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES riders(id),
    settlement_batch_id UUID REFERENCES settlement_batches(id),
    delivery_earnings NUMERIC(10, 2) NOT NULL,
    cod_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status settlement_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rider_trips_rider ON rider_trip_ledgers(rider_id);
CREATE INDEX idx_rider_trips_settlement_batch ON rider_trip_ledgers(settlement_batch_id);

-- 21. Rider Cash Hub Deposits (status is a VARCHAR convention, not an SQL enum)
CREATE TABLE cash_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    note TEXT,
    deposited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cash_deposits_rider_id ON cash_deposits(rider_id);
CREATE INDEX idx_cash_deposits_status ON cash_deposits(status);

-- 22. Payments & Gateway Transactions (ADR-011)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100) UNIQUE,
    session_key VARCHAR(150),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    status payment_status NOT NULL DEFAULT 'PENDING',
    gateway_response JSONB,
    refund_id VARCHAR(100),
    refunded_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_status ON payments(status);

-- 23. Central Media Asset Library (ADR-016)
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    size_bytes INT NOT NULL,
    width INT,
    height INT,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_media_assets_created_at ON media_assets(created_at);
```

---

## 4. Critical Spatial Queries

### 4.1 Outlet Discovery by Customer Location
```sql
SELECT 
    v.id, 
    v.name, 
    v.vertical, 
    v.logo_url,
    ROUND((ST_Distance(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000)::numeric, 2) AS distance_km
FROM vendors v
WHERE v.is_active = TRUE
  AND ST_DWithin(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, v.delivery_radius_km * 1000)
ORDER BY distance_km ASC;
```

### 4.2 Cart Address Geofence Guard (Strict Coverage Enforcement)
```sql
SELECT ST_DWithin(
    (SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography FROM customer_addresses WHERE id = :address_id),
    (SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography FROM vendors WHERE id = :vendor_id),
    (SELECT delivery_radius_km * 1000 FROM vendors WHERE id = :vendor_id)
) AS is_within_coverage;
```
