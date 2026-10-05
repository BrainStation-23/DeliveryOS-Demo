import { computeRiderEarnings } from './rider-earnings';

describe('computeRiderEarnings', () => {
  it('computes default 80% earnings correctly', () => {
    expect(computeRiderEarnings(100)).toBe(80);
    expect(computeRiderEarnings(50)).toBe(40);
    expect(computeRiderEarnings(60)).toBe(48);
  });

  it('computes custom rider share percentage with rounding', () => {
    expect(computeRiderEarnings(100, 75)).toBe(75);
    expect(computeRiderEarnings(65.5, 70)).toBe(45.85);
  });

  it('handles Prisma Decimal or objects with toString', () => {
    const decimalLike = { toString: () => '95.50' };
    expect(computeRiderEarnings(decimalLike, 80)).toBe(76.4);
  });
});
