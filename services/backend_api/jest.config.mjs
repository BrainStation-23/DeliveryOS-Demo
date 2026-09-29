/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Coverage is enforced on the money-path modules with real unit suites;
  // repo-wide thresholds activate as auth/order/settlement suites land.
  collectCoverageFrom: [
    'src/modules/orders/order-state.machine.ts',
    'src/modules/order-flow/order-flow.service.ts',
    'src/modules/payments/payments.service.ts',
    'src/modules/promotions/coupons/coupon.service.ts',
    'src/modules/promotions/pricing/delivery-fee.service.ts',
    'src/common/utils/region-time.ts',
    'src/common/utils/haversine.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 30,
      lines: 40,
      functions: 30,
    },
  },
};
