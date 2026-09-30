import { DiscountType } from '@prisma/client';
import { CouponService } from './coupon.service';

function buildService(coupon: Record<string, unknown> | null) {
  const prisma = {
    coupon: { findUnique: jest.fn().mockResolvedValue(coupon) },
  };
  return { service: new CouponService(prisma as never), prisma };
}

const baseCoupon = {
  id: 'coupon-1',
  code: 'WELCOME50',
  isActive: true,
  validFrom: new Date('2026-01-01'),
  validTo: new Date('2027-01-01'),
  currentUses: 0,
  usageLimit: 100,
  minOrderAmount: '0',
  discountType: DiscountType.FLAT,
  discountValue: '50',
  maxDiscountAmount: null,
};

describe('Coupon validation guard', () => {
  it('validates an eligible coupon and reports its usage limit for the checkout claim', async () => {
    const { service } = buildService({ ...baseCoupon });
    const result = await service.validateCoupon({ code: 'welcome50', cartSubtotal: 300 } as never);

    expect(result.isValid).toBe(true);
    expect(result.usageLimit).toBe(100);
    expect(result.discountAmount).toBe(50);
    expect(result.minOrderAmount).toBe(0);
    expect(result.finalSubtotal).toBe(250);
  });

  it('normalizes the code case-insensitively before lookup', async () => {
    const { service, prisma } = buildService({ ...baseCoupon });

    await service.validateCoupon({ code: '  WeLcOmE50  ', cartSubtotal: 300 } as never);

    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'WELCOME50' } });
  });

  it('rejects an exhausted coupon before any discount is computed', async () => {
    const { service } = buildService({ ...baseCoupon, currentUses: 100, usageLimit: 100 });
    await expect(
      service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 300 } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects unknown or inactive coupons', async () => {
    const { service } = buildService(null);
    await expect(
      service.validateCoupon({ code: 'GHOST', cartSubtotal: 300 } as never),
    ).rejects.toMatchObject({ status: 400 });

    const inactive = buildService({ ...baseCoupon, isActive: false });
    await expect(
      inactive.service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 300 } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects coupons outside their validity window (expired or not yet active)', async () => {
    const expired = buildService({ ...baseCoupon, validTo: new Date('2026-06-01') });
    await expect(
      expired.service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 300 } as never),
    ).rejects.toThrow(/expired or is not yet active/);

    const scheduled = buildService({ ...baseCoupon, validFrom: new Date('2030-01-01') });
    await expect(
      scheduled.service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 300 } as never),
    ).rejects.toThrow(/expired or is not yet active/);
  });

  it('rejects carts below the minimum spend threshold', async () => {
    const { service } = buildService({ ...baseCoupon, minOrderAmount: '500' });

    await expect(
      service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 499.99 } as never),
    ).rejects.toThrow(/must be at least 500/);
  });

  it('caps percentage discounts at maxDiscountAmount', async () => {
    const { service } = buildService({
      ...baseCoupon,
      discountType: DiscountType.PERCENTAGE,
      discountValue: '20',
      maxDiscountAmount: '80',
    });

    // 20% of 1000 = 200, capped at 80
    const result = await service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 1000 } as never);
    expect(result.discountAmount).toBe(80);
    expect(result.finalSubtotal).toBe(920);
  });

  it('computes uncapped percentage discounts from the cart subtotal', async () => {
    const { service } = buildService({
      ...baseCoupon,
      discountType: DiscountType.PERCENTAGE,
      discountValue: '15',
      maxDiscountAmount: null,
    });

    const result = await service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 430 } as never);
    expect(result.discountAmount).toBe(64.5);
    expect(result.finalSubtotal).toBe(365.5);
  });

  it('never lets a FLAT discount exceed the cart subtotal', async () => {
    const { service } = buildService({ ...baseCoupon, discountValue: '500' });

    const result = await service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 120 } as never);
    expect(result.discountAmount).toBe(120);
    expect(result.finalSubtotal).toBe(0);
  });

  it('rounds discounts and subtotals to exact 2-decimal precision', async () => {
    const { service } = buildService({
      ...baseCoupon,
      discountType: DiscountType.PERCENTAGE,
      discountValue: '33',
    });

    // 33% of 100 = 33 exactly; use a value that produces repeating decimals
    const result = await service.validateCoupon({ code: 'WELCOME50', cartSubtotal: 101 } as never);
    expect(result.discountAmount).toBe(33.33);
    expect(result.finalSubtotal).toBe(67.67);
  });
});
