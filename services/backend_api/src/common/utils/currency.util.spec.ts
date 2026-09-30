import { roundMoney } from './currency.util';

describe('roundMoney', () => {
  it('rounds to exactly two decimals', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(33.333333)).toBe(33.33);
  });

  it('guards the classic floating-point half-cent trap', () => {
    // 1.005 in binary floating point is 1.004999...; naive rounding yields 1.00
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
  });

  it('returns 0 for non-finite input instead of NaN poisoning ledgers', () => {
    expect(roundMoney(NaN)).toBe(0);
    expect(roundMoney(Infinity)).toBe(0);
    expect(roundMoney(-Infinity)).toBe(0);
  });

  it('preserves large sum precision', () => {
    expect(roundMoney(1234567.891)).toBe(1234567.89);
  });
});
