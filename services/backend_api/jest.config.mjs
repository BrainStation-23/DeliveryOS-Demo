/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Coverage is enforced per money-path module. Per-file thresholds are the
  // anti-bypass gate: deleting or hollowing out a spec drops its module below
  // the floor and fails CI. Raising thresholds is fine; lowering them requires
  // an explicit, reviewable jest.config.mjs change.
  collectCoverageFrom: [
    'src/common/guards/jwt-auth.guard.ts',
    'src/common/guards/roles.guard.ts',
    'src/common/utils/currency.util.ts',
    'src/common/utils/haversine.ts',
    'src/common/utils/region-time.ts',
    'src/modules/auth/auth.service.ts',
    'src/modules/order-flow/order-flow.service.ts',
    'src/modules/orders/order-state.machine.ts',
    'src/modules/payments/payments.service.ts',
    'src/modules/promotions/coupons/coupon.service.ts',
    'src/modules/promotions/pricing/delivery-fee.service.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 70,
      lines: 85,
      functions: 70,
    },
    './src/common/guards/jwt-auth.guard.ts': {
      statements: 95,
      branches: 80,
      lines: 95,
      functions: 90,
    },
    './src/common/guards/roles.guard.ts': {
      statements: 100,
      branches: 90,
      lines: 100,
      functions: 100,
    },
    './src/common/utils/currency.util.ts': {
      statements: 100,
      branches: 100,
      lines: 100,
      functions: 100,
    },
    './src/common/utils/haversine.ts': {
      statements: 100,
      branches: 100,
      lines: 100,
      functions: 100,
    },
    './src/common/utils/region-time.ts': {
      statements: 100,
      branches: 75,
      lines: 100,
      functions: 100,
    },
    './src/modules/auth/auth.service.ts': {
      statements: 90,
      branches: 80,
      lines: 90,
      functions: 90,
    },
    './src/modules/order-flow/order-flow.service.ts': {
      statements: 85,
      branches: 70,
      lines: 85,
      functions: 70,
    },
    './src/modules/orders/order-state.machine.ts': {
      statements: 100,
      branches: 100,
      lines: 100,
      functions: 100,
    },
    './src/modules/payments/payments.service.ts': {
      statements: 85,
      branches: 70,
      lines: 85,
      functions: 50,
    },
    './src/modules/promotions/coupons/coupon.service.ts': {
      statements: 100,
      branches: 90,
      lines: 100,
      functions: 100,
    },
    './src/modules/promotions/pricing/delivery-fee.service.ts': {
      statements: 100,
      branches: 90,
      lines: 100,
      functions: 100,
    },
  },
};
