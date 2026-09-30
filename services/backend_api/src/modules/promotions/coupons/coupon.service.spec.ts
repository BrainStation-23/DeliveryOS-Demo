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
});
