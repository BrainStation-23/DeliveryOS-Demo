# 🚲 DeliveryOS

### The Complete On-Demand Delivery Platform — Food, Grocery, Super Shop & Retail

> **"Foodpanda / Uber Eats / Instacart — in a box."**
> 📱 Customer app · 🍳 Store portal · 🛵 Courier app · 🖥️ Control tower — one real-time engine.
> White-label ready · Production ready.

<p>
  <img alt="Flutter" src="https://img.shields.io/badge/mobile-Flutter%20%203.8-02569B?logo=flutter&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/web-React%2018-61DAFB?logo=react&logoColor=black">
  <img alt="NestJS" src="https://img.shields.io/badge/backend-NestJS%2010-E0234E?logo=nestjs&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/db-PostgreSQL%2016%20%2B%20PostGIS-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/cache-Redis%207.2-DC382D?logo=redis&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/deploy-Docker%20%2B%20Nginx-2496ED?logo=docker&logoColor=white">
</p>

> 🎬 **Interactive tour — start here:** **[brainstation-23.github.io/DeliveryOS-Demo](https://brainstation-23.github.io/DeliveryOS-Demo/)** — scroll-animated, click-to-zoom, 45+ screens. The page is self-contained; `index.html` in this repo also runs offline from a double-click.
> 🧭 Prefer reading? Five minutes, below.
> 🔧 Engineering? → **[TECHNICAL.md](TECHNICAL.md)**

**Contents** · [What Is DeliveryOS](#-what-is-deliveryos) · [Big Picture](#-the-big-picture-four-apps-one-engine) · [Order Journey](#-the-order-journey-from-craving-to-doorstep) · [Feature Tour](#-feature-tour) · [Platform Logic](#-how-the-platform-thinks) · [Tech Stack](#-technology-stack) · [Architecture](#-system-architecture-and-ingress-topology) · [Security](#-security-and-reliability) · [White-Label](#-white-label-ready) · [Run It](#-run-it-locally) · [Repo & Docs](#-repository-layout-and-documentation) · [Roadmap](#-roadmap-status)

---

## 🌟 What Is DeliveryOS

One system for the whole delivery loop: discovery, checkout, kitchen prep, courier dispatch, live tracking, cash and payouts — connected in real time. Replaces the phone calls, paper tickets and spreadsheet dispatch that local delivery usually runs on.

| | |
| :--- | :--- |
| **Runs** | discovery → cart → checkout → store prep → dispatch → live tracking → cash → payouts |
| **Built for** | delivery startups · restaurant chains & cloud kitchens · supermarkets & pharmacies · fleet operators |
| **Delivers** | anything hyperlocal — business categories are data, not code |
| **Runs on** | iOS + Android (Flutter) · two web portals · one API engine · all containerized |
| **Speaks** | English · Bengali · Arabic built-in (full RTL) · any language via one translation file |
| **Handles money** | `BDT ৳` & `SAR ر.س` built-in · any currency via config · exact 2-decimal math · double-entry ledgers |
| **Rebrands** | yes — [White-Label Ready](#-white-label-ready) |

---

## 🧭 The Big Picture: Four Apps, One Engine

```text
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  📱 Customer App │ ───▶ │  ⚙️ DeliveryOS Engine │ ◀─── │  🛵 Rider App    │
└─────────────────┘      │  orders · dispatch ·  │      └─────────────────┘
                         │  payments · tracking  │
┌─────────────────┐      └──────────▲───────────┘      ┌─────────────────┐
│ 🍳 Outlet Portal │ ───────────────┴────────────────── │ 🖥️ Admin Console │
└─────────────────┘                                      └─────────────────┘
```

One event updates every screen that cares — instantly, no refresh.

| Screen | Who · What |
| :---: | :--- |
| <img src="screenshots-opt/thumbs/Admin/1-Dashboard.webp" width="440" alt="Admin Console dashboard"><br/><sub><b>🖥️ Super Admin Console</b></sub> | Operators & dispatchers — radar, analytics, orders, fleet, promotions, finance, manual overrides |
| <img src="screenshots-opt/thumbs/Merchant/1-Merchant-Dashboard.webp" width="440" alt="Outlet KDS board"><br/><sub><b>🍳 Outlet Portal</b></sub> | Store staff & brand owners — order board, prep timers, stock toggles, sales ledgers |
| <img src="screenshots-opt/thumbs/Customer/2-Customer-Home.webp" width="240" alt="Customer app home feed"><br/><sub><b>📱 Customer App</b></sub> | Shoppers — discover, cart, pay, track live |
| <img src="screenshots-opt/thumbs/Rider/3-Rider-Home.webp" width="240" alt="Rider app dashboard"><br/><sub><b>🛵 Rider App</b></sub> | Couriers — duty, trip alerts, guided delivery, COD cash |

---

## 📦 The Order Journey: From Craving to Doorstep

Follow one order across all four apps — a burger, a grocery basket or a pharmacy refill; the flow is identical for every vertical.

```mermaid
flowchart TD
    A["📱 Customer places the order"] --> B["⚙️ Engine validates cart, coupon and fee"]
    B --> C{"Outlet dispatch mode"}
    C -->|Rider First| D["🛵 Courier broadcast — first to claim wins"]
    C -->|Outlet First| E["🏪 Store is alerted and prepares"]
    E --> F["📦 Ready — courier broadcast begins"]
    D --> G["🍳 Store prepares and hands over"]
    F --> G2["🛵 Courier claims and picks up"]
    G --> H["📡 DISPATCHED — live GPS tracking"]
    G2 --> H
    H --> I["✅ DELIVERED — ledgers and earnings settle"]
    B -.->|cancel or failure| X["❌ CANCELLED — auto refunds and rollbacks"]
```

### Stage 1: The Customer Orders

- Sign in with a 6-digit SMS code. No passwords exist anywhere.
- Pin the delivery location — GPS coverage is checked before the feed loads.
- Home feed sorted by true distance, with promo banners and category chips.
- Customize items, apply a coupon, pick COD or online, review the full bill.

<p align="center">
  <img src="screenshots-opt/thumbs/Customer/1-Customer-Map.webp" width="240" alt="Customer map location picker" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Customer/2-Customer-Home.webp" width="240" alt="Customer home feed" />
</p>
<p align="center"><sub><b>Left:</b> map picker — place search, saved places, current location. · <b>Right:</b> home feed — banners, chips, distance-sorted cards.</sub></p>

<p align="center">
  <img src="screenshots-opt/thumbs/Customer/4-Customer-Outlet-Details.webp" width="240" alt="Outlet storefront" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Customer/5-Customer-Item-Details.webp" width="240" alt="Item customizer" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Customer/6-Customer-Cart.webp" width="240" alt="Cart and checkout" />
</p>
<p align="center"><sub><b>Left:</b> storefront — pinned search, live cart steppers. · <b>Middle:</b> customizer — variants, instructions. · <b>Right:</b> guarded checkout.</sub></p>

> Address, variants and prices are **frozen onto the order** at checkout — later menu edits can never rewrite a receipt. The coupon is claimed inside the same database transaction, so the last code cannot sell twice.

### Stage 2: The Store Prepares

- The order lands with a bell that rings every 3 seconds until acknowledged.
- One tap accepts and starts a prep countdown — amber at 5 minutes, red when late.
- Three lanes: New → Preparing → Ready. "Hand to Rider" closes the loop.
- Kitchen overloaded? One click pauses incoming orders.

<p align="center">
  <img src="screenshots-opt/thumbs/Merchant/2-Merchant-Order-Details.webp" width="640" alt="Outlet order ticket" />
</p>
<p align="center"><sub><b>Order ticket</b> — line items, customer notes, one-tap accept with prep-time pills.</sub></p>

> The chime is synthesized in the browser with the Web Audio API. No audio files, nothing to fail on flaky kitchen Wi-Fi.

### Stage 3: The Courier Delivers

- Nearby couriers get a 45-second full-screen alert: chime, haptics, countdown.
- First tap wins — a distributed lock makes two winners impossible.
- A guided three-step trip with Maps handoff and call buttons.
- Cash orders will not close until the courier confirms "I collected ৳X".
- Customer not answering? Built-in SOP: call twice, knock, wait a timed 5 minutes, release.

<p align="center">
  <img src="screenshots-opt/thumbs/Rider/4-Rider-New-Order.webp" width="240" alt="Rider dispatch alert" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Rider/6-Rider-Order-Details.webp" width="240" alt="Rider active trip steps" />
</p>
<p align="center"><sub><b>Left:</b> 45-second dispatch alert. · <b>Right:</b> the guided three-step trip.</sub></p>

> A 10-second distributed lock picks the winner, backed by a guarded database update. A hundred couriers can tap at once — exactly one trip exists afterward.

### Stage 4: The Customer Tracks It Live

- The courier's position streams live onto the map, with route and ETA.
- Six-stage timeline showing the real timestamp at each step.
- One-tap call to courier or store.
- Online payment failed? One tap switches the order to cash.
- Free cancellation until prep starts — refund and coupon restore automatically.

<p align="center">
  <img src="screenshots-opt/thumbs/Customer/7-Customer-Live-Tracking.webp" width="240" alt="Customer live tracking" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Customer/11_Customer_Order_Details.webp" width="240" alt="Customer order receipt" />
</p>
<p align="center"><sub><b>Left:</b> live radar map + timeline. · <b>Right:</b> the immutable digital receipt.</sub></p>

> The tracking socket is reference-counted — connected only while an order runs or the screen is open, torn down otherwise. Nothing polls in the background.

### Stage 5: The Money Settles

- Every delivery writes double-entry books: commission, outlet payout, courier pay.
- Couriers watch earnings plus a COD cash meter — green, amber, red.
- At the limit they deposit cash at the hub; admin verifies; the balance clears.
- Settlement batches pay outlets, netting COD cash so nobody is paid twice.

<p align="center">
  <img src="screenshots-opt/thumbs/Rider/8-Rider-Earnings.webp" width="240" alt="Rider earnings" />
  &nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Rider/9-Rider-Home-Cash-Reached.webp" width="240" alt="Rider cash limit alert" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="screenshots-opt/thumbs/Admin/16-Cash-Drops.webp" width="440" alt="Admin cash deposit verification" />
</p>
<p align="center"><sub><b>Left:</b> earnings + COD in hand. · <b>Middle:</b> cash-limit alert. · <b>Right:</b> admin deposit verification queue.</sub></p>

<p align="center">
  <img src="screenshots-opt/thumbs/Admin/15-Outlet-Settlements.webp" width="640" alt="Admin settlements" />
</p>
<p align="center"><sub><b>Settlements</b> — payout batches, audit trails, accounting-ready CSV export.</sub></p>

> Settlement pays a courier `max(0, earnings − COD collected)`. Someone already holding platform cash is never paid cash on top of it.

### Who Sees What, and When

| Event | 📱 Customer | 🍳 Outlet | 🛵 Rider | 🖥️ Admin |
| :--- | :--- | :--- | :--- | :--- |
| **Order placed** | Running-order bar | 🔔 Chime + *New* lane | *(rider-first)* dispatch alert | Radar + counters tick |
| **Store accepts** | Timeline → "Preparing" | Countdown starts | — | Status flips |
| **Courier claims** | Courier card + call button | Courier name in *Ready* lane | Active trip opens | Pin turns sky-blue |
| **Courier GPS tick** | Dot & ETA update | — | Background GPS streams | Pin glides on radar |
| **Handed over** | Stage → "On the way" | Card leaves board | Step 2: deliver | Status → DISPATCHED |
| **Delivered** | Receipt + clock | Ledger entry lands | Earnings + COD update | Ledgers write |
| **Cancelled** | Refund + reason | Card vanishes | Alert + clean release | Audit log (reason required) |

---

## 🖼️ Feature Tour

### 📱 Customer App

- Phone-OTP sign-in
- Map pin and saved places drive discovery app-wide
- Storefronts with pinned menu search, live cart steppers, sold-out badges
- One search box finds products *and* stores
- Guarded checkout — coupons, limits, closed-store and rush protection
- Live tracking: courier radar, timeline, call buttons, one-tap switch to cash
- Order history with validated re-order (re-checks stock and price)
- English, Bengali, Arabic (RTL) · light and dark themes

<table>
  <tr>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Customer/0-Customer-On-Board.webp" width="240"><br/><sub><b>Onboarding</b></sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Customer/8_Customer_Profile.webp" width="240"><br/><sub><b>Profile</b> — name, avatar, hotline</sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Customer/9_Customer_Saved_Location.webp" width="240"><br/><sub><b>Saved places</b> — home, work, custom pins</sub></td>
  </tr>
  <tr>
    <td align="center" colspan="3"><img src="screenshots-opt/thumbs/Customer/10_Customer_Order_List.webp" width="240"><br/><sub><b>Order history</b> — status badges, re-order, live-tracking CTA</sub></td>
  </tr>
</table>

### 🏪 Outlet Portal

- Three-lane KDS with prep timers and elapsed badges
- Synthesized chime loop — zero audio downloads
- One-click stock toggles at item and variant level
- Rush-hour pause and resume
- Sales ledger with KPI cards and date presets
- Prep defaults, weekly hours, multi-branch switcher for brand owners

<table>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Merchant/0-Merchant-Login.webp" width="440"><br/><sub><b>Staff sign-in</b> — phone + OTP, scoped to a branch or whole brand</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Merchant/3-Merchant-Menu.webp" width="440"><br/><sub><b>Catalog & stock</b> — one-click sold-out toggles</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Merchant/4-Merchant-Order-List.webp" width="440"><br/><sub><b>Sales ledger</b> — date filters, KPI cards</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Merchant/5-Merchant-Settings.webp" width="440"><br/><sub><b>Operations</b> — rush pause, prep time, weekly hours</sub></td>
  </tr>
</table>

### 🛵 Rider App

- Application with an admin approval gate before the first trip
- One-tap duty toggle; background GPS streams every ~10 m
- Cannot go offline mid-delivery (in-flight lock)
- 45-second alerts with atomic claiming
- Three-step guided trip with native navigation handoff
- Doorstep SOP with a timed 5-minute countdown
- Earnings today/this week, COD cash meter, hub deposits with history

<table>
  <tr>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/0-Rider-Demo-Login.webp" width="240"><br/><sub><b>Sign-in</b> — phone + OTP</sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/1-Rider-Signup.webp" width="240"><br/><sub><b>Application</b> — join the fleet</sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/2-Rider-Pending-Application.webp" width="240"><br/><sub><b>Approval gate</b> — document review</sub></td>
  </tr>
  <tr>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/3-Rider-Home.webp" width="240"><br/><sub><b>Duty dashboard</b> — online/offline toggle</sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/5-Rider-New-Order-Home.webp" width="240"><br/><sub><b>Active trip</b> — pinned on Home</sub></td>
    <td width="33%" align="center"><img src="screenshots-opt/thumbs/Rider/7-Rider-Profile.webp" width="240"><br/><sub><b>Profile</b> — identity & vehicle</sub></td>
  </tr>
</table>

### 🖥️ Admin Console

- Date-ranged analytics with trend badges
- Live fleet radar on OpenStreetMap — no map licensing fees
- Order management with force-assign and force-cancel
- Fleet roster, applicant queue, approvals, per-courier cash limits
- Brands → outlets → catalog → variations with deletion guards
- Staff and customer directories
- Banners with deep links, coupon engine, central media library
- Finance: per-order ledger, settlement cycles, CSV export
- Confirm-gated settings for dispatch timing, fees, economics, order limits

<table>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/0-Admin-Login-Screen.webp" width="440"><br/><sub><b>Sign-in</b> — phone + OTP</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/2-Order-History.webp" width="440"><br/><sub><b>Order history</b> — tabs, glance cards, unassigned-only filter</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/3-Order-Details.webp" width="440"><br/><sub><b>Order details</b> — lifecycle timeline, money breakdown</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/4-Rider-Fleet.webp" width="440"><br/><sub><b>Fleet</b> — radar, unassigned pool, roster</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/5-Rider-Details.webp" width="440"><br/><sub><b>Courier details</b> — stats, cash, governance</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/6-Brand-List.webp" width="440"><br/><sub><b>Brands & outlets</b> — owners, per-outlet rosters</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/7-Outlet-Details.webp" width="440"><br/><sub><b>Outlet page</b> — catalog, category governance, hours</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/8-Outlet-Locaiton-Define.webp" width="440"><br/><sub><b>Location picker</b> — pin the outlet on the map</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/9-Outlet-Item-Edit.webp" width="440"><br/><sub><b>Product editor</b> — variations with absolute prices</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/10-Staff-Account-List.webp" width="440"><br/><sub><b>Staff accounts</b> — roles, instant lockout</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/11-Customer-Details.webp" width="440"><br/><sub><b>Customer directory</b> — lifetime metrics</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/12-Promotional-Banner.webp" width="440"><br/><sub><b>Banners</b> — schedule, deep-link the carousel</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/13-Coupon-Code.webp" width="440"><br/><sub><b>Coupons</b> — flat or %, caps, usage limits</sub></td>
    <td width="50%" align="center"><img src="screenshots-opt/thumbs/Admin/14-Media-Zone.webp" width="440"><br/><sub><b>Media library</b> — crop, resize, reuse</sub></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><img src="screenshots-opt/thumbs/Admin/17-Admin%20System%20Settings.webp" width="440"><br/><sub><b>System settings</b> — dispatch timing, fee engine, order limits</sub></td>
  </tr>
</table>

---

## ⚙️ How the Platform Thinks

### Two dispatch modes, per outlet

| Mode | Flow | Fits |
| :--- | :--- | :--- |
| **Rider First** *(Zero Waste)* | Courier claims first → store cooks into a waiting bag | hot food |
| **Outlet First** *(Traditional)* | Store prepares → courier called at Ready | grocery · pharmacy · retail |

No taker in time? The broadcast escalates through 5 → 6 → 10 km rings, and orders that age past a configurable TTL auto-cancel with full refunds.

### The order state ladder

```mermaid
flowchart LR
    A[Placed] --> B[Rider Assigned]
    A --> P[Preparing]
    B --> P
    P --> R[Ready for Pickup]
    R --> D[Dispatched]
    D --> L[Delivered]
    A -.-> X[Cancelled]
    B -.-> X
    P -.-> X
    R -.-> X
```

Every transition is guarded, timestamped and broadcast to all four apps.

### Guardrails

- Money is never approximate — 2-decimal database types, double-entry ledgers.
- COD cash cannot pile up — limits, hub deposits, settlement offset.
- Exactly one claimer per order — a 10-second distributed lock.
- Store hours follow the outlet's local wall clock, never server time — correct in any timezone.
- Online orders release only after a signed bank webhook confirms payment.

---

## 🛠️ Technology Stack

| Layer | Tech | Why |
| :--- | :--- | :--- |
| Mobile apps | **Flutter** (Dart ³·³⁸) · Riverpod 3 · Dio | one codebase → iOS + Android, 60 fps |
| Web portals | **React 18** · Vite · Tailwind · Zustand · TanStack Query | sub-second dashboards |
| API engine | **NestJS 10** · TypeScript · Prisma 5 | 14 modules, ~60 admin routes, strict types |
| Realtime | **Socket.IO 4** | push updates, no polling |
| Database | **PostgreSQL 16 + PostGIS 3.4** | 23 models + map-distance math in the query layer |
| Speed layer | **Redis 7.2** | live courier positions · atomic locks · OTP codes |
| Maps | Google Maps (mobile) · **Leaflet + OSM** (admin) | zero radar licensing cost |
| Payments | **SSLCommerz** + COD | signed idempotent webhooks, refunds |
| Messaging | SSL Wireless SMS · **FCM** | OTP + push |
| Monitoring | Sentry · Winston JSON | errors with request IDs |
| Deploy | **Nginx · Docker** | one front door, identical everywhere |

→ Full engineering detail in [TECHNICAL.md](TECHNICAL.md).

---

## 🏗️ System Architecture and Ingress Topology

One Nginx edge on port 8080 routes everything — one domain, one TLS certificate, no cross-origin pain:

```mermaid
flowchart TD
    subgraph Clients["Client Tier — Mobile & Web"]
        CA["📱 Customer App"]
        RA["🛵 Rider App"]
        AP["🖥️ Admin Console"]
        VP["🍳 Outlet Portal"]
    end

    subgraph Edge["Nginx Edge — port 8080"]
        NGINX["🌐 TLS · subpath routing · gzip · WebSocket upgrade"]
    end

    subgraph Web["Web Tier"]
        AP_SVC["Admin Portal<br/>(:3000, serves /)"]
        VP_SVC["Outlet Portal<br/>(:3001, serves /outlet/)"]
    end

    subgraph Core["Application Core — :4000"]
        API["⚙️ REST API /api/v1"]
        WSS["📡 Socket.IO /events"]
    end

    subgraph Data["Data Tier"]
        PG[("🐘 PostgreSQL 16<br/>+ PostGIS :5433")]
        RD[("⚡ Redis 7.2<br/>:6380")]
    end

    CA --> NGINX
    RA --> NGINX
    AP --> NGINX
    VP --> NGINX
    NGINX -->|"/ → :3000"| AP_SVC
    NGINX -->|"/outlet/ → :3001"| VP_SVC
    NGINX -->|"/api/v1/ · /uploads/ → :4000"| API
    NGINX -->|"/events WebSocket → :4000"| WSS
    API --> PG
    API --> RD
    WSS --> RD
```

**Tap "Place Order" — what happens**

1. `POST /api/v1/orders` with a 15-minute access token.
2. Nginx → NestJS: JWT, role and rate limit all checked.
3. One database transaction: order number assigned, coupon claimed, fee computed, snapshots frozen, state `PLACED`.
4. Dispatch broadcasts — socket room pop-up plus push notification in radius rings.
5. Riders claim; a Redis lock picks one winner in milliseconds.
6. The state machine advances, ledgers write, all four UIs update live.

Realtime runs on private rooms — one per customer, order, store and courier — and the server checks identity at every door.

→ Protocol, data model and dispatch internals: **[TECHNICAL.md](TECHNICAL.md)**

---

## 🔐 Security and Reliability

| Area | What it does |
| :--- | :--- |
| **Login** | Phone OTP only — nothing to leak; codes expire in 2 min, 5 strikes lock them |
| **Sessions** | 15-min access tokens + rotating 30-day refresh with server-side revocation |
| **Permissions** | Role-based on every route *and* every realtime room |
| **Payments** | Bank webhooks HMAC-signed and idempotent — replays and forgeries rejected |
| **Hardening** | Helmet · CORS whitelist · 100 req/min cap · fail-fast config · non-root containers · TLS auto-renewal |
| **Backups** | Automated, off-site option, 7-day retention, restore verified live |
| **Testing** | 350+ backend money-path tests · 198 + 48 portal tests · 2 Flutter suites · anti-cheat test guard, all in CI |
| **Design** | One token spec across 4 frontends, dual themes — CI-enforced |

---

## 🎨 White-Label Ready

1. Colors, type and radii live in one token spec per app — rebrand in minutes.
2. Verticals are data: launch pharmacy-only or a combined super-app without code changes.
3. Deterministic multi-currency money; add any region.
4. English, Bengali, Arabic (RTL) — a new language is one translation file.
5. Each app ships its own package name, icon and splash.
6. Payment gateways and SMS carriers sit behind adapters; swap per market.

---

## 🚀 Run It Locally

One command boots the whole stack — database, cache, API, both portals, edge:

```bash
./scripts/start-local.sh --docker     # → http://localhost:8080
```

**Prerequisites**: Node.js 20+ · Docker · Flutter (Dart ³·³⁸)

| URL | What |
| :--- | :--- |
| `http://localhost:8080/` | 🖥️ Admin console |
| `http://localhost:8080/outlet/` | 🍳 Outlet portal |
| `http://localhost:8080/api/v1/` | ⚙️ REST API (Swagger at `/docs`, dev only) |
| `http://localhost:8080/events` | 📡 WebSocket gateway |

**Demo data** — the seed creates one demo account per role (Super Admin, branch manager, brand owner, rider, customer) plus **~114 orders in every state** with complete financial books, outlet categories (one hidden — visibility demo), coupons (incl. expired & exhausted), and banners across all link types.

> 🔐 This is the public evaluation copy — demo credentials, `.env` files and internal runbooks are shared separately with evaluators, never published.

---

## 📁 Repository Layout and Documentation

This repo is the product showcase. The engineering monorepo holds the source:

```text
DeliveryOS/
├── apps/
│   ├── admin_portal/       # Admin console (React 18 + Vite + Tailwind + Leaflet OSM)
│   ├── outlet_portal/      # Outlet KDS portal (React 18 + Vite + Web Audio)
│   ├── customer_app/       # Customer app (Flutter + Riverpod 3)
│   └── rider_app/          # Rider app (Flutter + Riverpod 3)
├── services/backend_api/   # NestJS 10 + Prisma 5 engine (REST + Socket.IO)
├── deploy/                 # Docker Compose (local & prod) · Nginx · systemd backups
├── scripts/                # start-local · build-android · backup/restore
├── context_docs/           # Living spec suite (see below)
├── FEATURES.md             # Granular capability catalog + test traceability
├── CHANGELOG.md            # SemVer history & roadmap
└── DESIGN.md               # Canonical design-system spec
```

Alongside the code lives a spec suite that stays in lockstep with it:

- **8 BRDs** — personas, journeys, operating handbooks
- **7 TIDs** — architecture, schema, API catalog, WebSocket protocol, state machine, frontend, deployment
- **27 ADRs** — the reasoning behind every major decision
- **3-phase workflow** — plan → implement → verify & sync docs, enforced by CI gates

→ Condensed engineering view: **[TECHNICAL.md](TECHNICAL.md)**

---

## 🗺️ Roadmap Status

| Milestone | Status |
| :--- | :---: |
| Foundation · core backend · realtime & dispatch (Docker stack, OTP auth, ACID checkout, dual-flow FSM, Redis claim mutex) | ✅ |
| Portals & mobile apps (fleet radar, 3-lane KDS, geofenced discovery, 6-stage tracking, 45s alerts, COD deposits) | ✅ |
| E2E & financial integrity (multi-role lifecycles; ledgers balance to the penny) | ✅ |
| Production hardening Waves 0–4 (CI gate, fail-fast security, real SMS/payments/push, Sentry, backups, scaling) | ✅ |
| Unified design system & dual themes (CI-enforced) | ✅ |
| **Live pilot** — 10 outlets · 5–8 couriers · 3–5 km zone | 🔜 |
| KSA region localization (`REGION_MODE=KSA`) | 🗓️ Post-launch |

---

<p align="center">
  <sub><b>DeliveryOS</b> — delivery as an operating system.<br/>
  🎬 <a href="https://brainstation-23.github.io/DeliveryOS-Demo/"><b>Interactive tour</b></a> · 45+ screens · gallery in <code>/screenshots</code> · engineering deep dive in <a href="TECHNICAL.md"><b>TECHNICAL.md</b></a></sub>
</p>
