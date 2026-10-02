import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerLinkType, DiscountType, OrderStatus, PermissionScope } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class UpdateRiderCashLimitDto {
  @ApiProperty({ example: 5000, minimum: 0, maximum: 100000, description: 'Maximum COD cash a courier may hold' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  maxCashLimit!: number;
}

export class ForceAssignRiderDto {
  @ApiProperty({ description: 'Rider profile id to force-assign' })
  @IsString()
  @IsNotEmpty()
  riderId!: string;
}

export class GetLiveOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'Filter by lifecycle status' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Search term for order number, customer name, or customer phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 inclusive lower bound on placedAt (e.g. 2026-10-01T00:00:00.000Z)' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 inclusive upper bound on placedAt (e.g. 2026-10-01T23:59:59.999Z)' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}

class BannerFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: BannerLinkType })
  @IsOptional()
  @IsEnum(BannerLinkType)
  linkType?: BannerLinkType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}

export class CreateBannerDto extends BannerFields {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  declare imageUrl: string;
}

export class UpdateBannerDto extends BannerFields {}

class CouponFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTo?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCouponDto extends CouponFields {
  @ApiProperty({ example: 'WELCOME50' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(40)
  declare code: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  declare discountType: DiscountType;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declare discountValue: number;
}

export class UpdateCouponDto extends CouponFields {}

class VendorFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional({ minimum: 0.1, maximum: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  deliveryRadiusKm?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 240 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  defaultPrepTimeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateVendorDto extends VendorFields {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  declare addressText: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  declare latitude: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  declare longitude: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  declare contactPhone: string;
}

export class UpdateVendorDto extends VendorFields {}

export class ToggleVendorStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

export class AssignVendorStaffDto {
  @ApiProperty({ description: 'User id to assign as outlet staff' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: PermissionScope })
  @IsEnum(PermissionScope)
  scope!: PermissionScope;

  @ApiPropertyOptional({ enum: ['VENDOR_ADMIN'], default: 'VENDOR_ADMIN' })
  @IsOptional()
  @IsIn(['VENDOR_ADMIN'])
  role?: string = 'VENDOR_ADMIN';

  @ApiPropertyOptional({ description: 'Required when scope is ALL_OUTLETS_MASTER' })
  @IsOptional()
  @IsString()
  brandId?: string;
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  declare name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OverrideProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInStock?: boolean;
}

export class ToggleProductStockDto {
  @ApiProperty()
  @IsBoolean()
  isInStock!: boolean;
}

export class UpdateDeliveryFeeDto {
  @ApiProperty({ enum: ['FIXED_FLAT', 'DISTANCE_TIERED'] })
  @IsIn(['FIXED_FLAT', 'DISTANCE_TIERED'])
  mode!: 'FIXED_FLAT' | 'DISTANCE_TIERED';

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatFee?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseKm?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  perKmRate?: number;
}

export class SetRiderApprovalDto {
  @ApiProperty()
  @IsBoolean()
  isApproved!: boolean;
}

export class GetRidersQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'ALL'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'ALL'])
  approvalStatus?: 'PENDING' | 'APPROVED' | 'ALL';

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isOnline?: 'true' | 'false';

  get isOnlineParsed(): boolean | undefined {
    return this.isOnline !== undefined ? this.isOnline === 'true' : undefined;
  }
}
