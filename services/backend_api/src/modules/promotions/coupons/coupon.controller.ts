import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Promotional Coupons')
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  // Public endpoint: a tight per-IP budget throttles coupon-code enumeration
  // probing far below the global 100 req/min default.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validate a coupon code against current cart subtotal' })
  @ApiResponse({ status: 200, description: 'Coupon is valid and discount calculated' })
  @ApiResponse({ status: 400, description: 'Coupon is invalid, expired, or min spend not met' })
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    const result = await this.couponService.validateCoupon(dto);
    return {
      message: `Coupon code ${result.code} applied successfully`,
      data: result,
    };
  }
}
