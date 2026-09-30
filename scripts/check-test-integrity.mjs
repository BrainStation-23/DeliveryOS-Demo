#!/usr/bin/env node
/**
 * Repo-wide test-integrity guard (anti-bypass gate).
 *
 * Runs in CI (`npm run verify`) and locally via `npm run verify:tests`.
 * It fails the build when:
 *   1. A required money-path spec file is missing or trivial (< 2 test cases).
 *   2. Any test file contains skip/only/todo markers or disabled suites
 *      (covers Jest, Vitest, and Flutter/Dart syntax — ESLint only sees TS).
 *   3. Any test file contains tautological assertions (e.g. expect(true)).
 *   4. A suite area's total test count drops below its recorded floor
 *      (deleting or hollowing out tests cannot pass silently).
 *
 * Floors are baselines, not ceilings: adding tests never fails; lowering a
 * floor requires an explicit, reviewable edit to this file.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const fail = (message) => failures.push(message);

/** Required money-path unit specs. Deleting any of these fails the gate. */
const REQUIRED_SPECS = [
  'services/backend_api/src/modules/auth/auth.service.spec.ts',
  'services/backend_api/src/modules/orders/order-state.machine.spec.ts',
  'services/backend_api/src/modules/order-flow/order-flow.service.spec.ts',
  'services/backend_api/src/modules/payments/payments.service.spec.ts',
  'services/backend_api/src/modules/promotions/coupons/coupon.service.spec.ts',
  'services/backend_api/src/modules/promotions/pricing/delivery-fee.service.spec.ts',
  'services/backend_api/src/common/guards/jwt-auth.guard.spec.ts',
  'services/backend_api/src/common/guards/roles.guard.spec.ts',
  'services/backend_api/src/common/utils/haversine.spec.ts',
  'services/backend_api/src/common/utils/currency.util.spec.ts',
  'apps/admin_portal/src/utils/formatters.test.ts',
  'apps/admin_portal/src/utils/apiError.test.ts',
  'apps/admin_portal/src/stores/useAuthStore.test.ts',
  'apps/vendor_portal/src/utils/formatters.test.ts',
  'apps/vendor_portal/src/utils/apiError.test.ts',
  'apps/vendor_portal/src/stores/useVendorOutletStore.test.ts',
];

/**
 * Test-count floors per suite area. Values are the recorded baseline counts
 * at the time this gate was introduced.
 */
const TEST_FLOORS = {
  'backend unit (jest)': { dir: 'services/backend_api/src', pattern: /\.spec\.ts$/, min: 150 },
  'admin portal unit (vitest)': { dir: 'apps/admin_portal/src', pattern: /\.test\.ts$/, min: 20 },
  'vendor portal unit (vitest)': { dir: 'apps/vendor_portal/src', pattern: /\.test\.ts$/, min: 22 },
  'customer app (flutter)': { dir: 'apps/customer_app/test', pattern: /_test\.dart$/, min: 45 },
  'rider app (flutter)': { dir: 'apps/rider_app/test', pattern: /_test\.dart$/, min: 35 },
};

const TS_TEST_CASE = /\b(?:it|test|testWidgets)\s*\(/g;
const DART_TEST_CASE = /\b(?:test|testWidgets)\s*\(/g;
const TS_SKIP_MARKERS = /\.(?:skip|only|todo)\s*\(|\b(?:xit|xtest|xdescribe)\s*\(/;
const DART_SKIP_MARKERS = /,\s*skip\s*:\s*true\b|\bskip:\s*true\b/;
const TAUTOLOGY = /expect\s*\(\s*true\s*\)/;

function walk(dir, pattern, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.dart_tool' || entry === 'build') continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(full, pattern, acc);
    else if (pattern.test(entry)) acc.push(full);
  }
  return acc;
}

function relative(path) {
  return path.slice(repoRoot.length + 1);
}

// --- Check 1: required specs exist and are non-trivial ---
for (const spec of REQUIRED_SPECS) {
  let content;
  try {
    content = readFileSync(join(repoRoot, spec), 'utf8');
  } catch {
    fail(`required test file is missing: ${spec}`);
    continue;
  }
  const caseCount = (content.match(TS_TEST_CASE) || []).length;
  if (caseCount < 2) {
    fail(`required test file is trivial (${caseCount} test cases, need >= 2): ${spec}`);
  }
}

// --- Check 2-4: scan every test file in every suite area ---
for (const [area, { dir, pattern, min }] of Object.entries(TEST_FLOORS)) {
  const files = walk(join(repoRoot, dir), pattern);
  if (files.length === 0) {
    fail(`${area}: no test files found under ${dir}`);
    continue;
  }

  let totalCases = 0;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const isDart = file.endsWith('.dart');
    const caseMatcher = isDart ? DART_TEST_CASE : TS_TEST_CASE;

    const cases = (content.match(caseMatcher) || []).length;
    totalCases += cases;
    if (cases < 2) {
      fail(`trivial test file (${cases} test cases, need >= 2): ${relative(file)}`);
    }

    if (isDart) {
      if (DART_SKIP_MARKERS.test(content)) {
        fail(`skipped tests are forbidden in CI: ${relative(file)}`);
      }
    } else if (TS_SKIP_MARKERS.test(content)) {
      fail(`skip/only/todo markers are forbidden in CI: ${relative(file)}`);
    }

    if (TAUTOLOGY.test(content)) {
      fail(`tautological assertion (expect(true)) found: ${relative(file)}`);
    }
  }

  if (totalCases < min) {
    fail(`${area}: ${totalCases} tests found, floor is ${min} — tests may have been deleted or hollowed out`);
  }
  console.log(`  ${area}: ${totalCases} tests (floor ${min}) — OK`);
}

if (failures.length > 0) {
  console.error(`\n✖ test-integrity guard failed (${failures.length} violation${failures.length === 1 ? '' : 's'}):`);
  for (const message of failures) console.error(`   - ${message}`);
  process.exit(1);
}

console.log('✔ test-integrity guard passed');
