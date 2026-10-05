import { roundMoney } from './currency.util';

/**
 * Calculates net courier earnings from delivery fee and rider share percentage.
 * Enforces two-decimal rounding and a default 80% platform split if not provided.
 */
export function computeRiderEarnings(
  deliveryFee: number | { toString(): string },
  riderSharePercent: number = 80,
): number {
  const feeNumber = typeof deliveryFee === 'number' ? deliveryFee : Number(deliveryFee.toString());
  const riderShare = (riderSharePercent || 80) / 100;
  return roundMoney(feeNumber * riderShare);
}
