import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates coupon eligibility and computes discount amount
   */
  async validateCoupon(dto: ValidateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon code.');
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      throw new BadRequestException('This coupon code has expired or is not yet active.');
    }

    if (coupon.currentUses >= coupon.usageLimit) {
      throw new BadRequestException('This coupon code has reached its maximum usage limit.');
    }

    const minSpend = Number(coupon.minOrderAmount);
    if (dto.cartSubtotal < minSpend) {
      throw new BadRequestException(
        `Order subtotal must be at least ${minSpend} to apply coupon code ${code}.`,
      );
    }

    let discountAmount = 0;
    const discountVal = Number(coupon.discountValue);

    if (coupon.discountType === DiscountType.PERCENTAGE) {
      const percentageDiscount = (dto.cartSubtotal * discountVal) / 100;
      discountAmount = coupon.maxDiscountAmount
        ? Math.min(percentageDiscount, Number(coupon.maxDiscountAmount))
        : percentageDiscount;
    } else if (coupon.discountType === DiscountType.FLAT) {
      discountAmount = Math.min(discountVal, dto.cartSubtotal);
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalSubtotal = Math.max(0, Math.round((dto.cartSubtotal - discountAmount) * 100) / 100);

    return {
      isValid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: discountVal,
      discountAmount,
      finalSubtotal,
    };
  }
}
