import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
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

export class CreateBrandDto {
  @ApiProperty({ example: 'Burger Point', description: 'Brand display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Brand logo URL (upload via the central media library)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;
}

export class UpdateBrandDto {
  @ApiPropertyOptional({ description: 'Brand display name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Brand logo URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;
}

export class CreateStaffUserDto {
  @ApiProperty({ example: '+8801712345678', description: 'Phone number — the account owner later signs in with OTP' })
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: 'Rahim Uddin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;
}

export class GetLiveOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'Filter by lifecycle status' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: ['UNASSIGNED', 'ASSIGNED'],
    description: 'Courier assignment filter — UNASSIGNED shows active orders (non-terminal) with no rider',
  })
  @IsOptional()
  @IsIn(['UNASSIGNED', 'ASSIGNED'])
  assignment?: 'UNASSIGNED' | 'ASSIGNED';

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

  @ApiPropertyOptional({ description: 'Target outlet/category id — required unless linkType is EXTERNAL' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;

  @ApiPropertyOptional({ description: 'Absolute http(s) URL opened on tap — required when linkType is EXTERNAL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetUrl?: string;

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
  @ApiProperty({ description: 'Owning brand — outlets cannot exist without one (ADR-017)' })
  @IsString()
  @IsNotEmpty()
  declare brandId: string;

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

export class SaveProductVariationDto {
  @ApiPropertyOptional({ description: 'Existing variation id (omit to create); absent ids are deleted' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: '12-inch Large' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 680, description: 'Absolute price of this variation (ADR-017)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty()
  @IsBoolean()
  isInStock!: boolean;
}

export class SaveProductDto {
  @ApiPropertyOptional({ description: 'Required when creating a product' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({ description: 'Category the product belongs to' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: 'Peri-Peri Crispy Chicken Burger' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Media-library image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ type: [SaveProductVariationDto], minLength: 1, description: 'Ordered — the first variation defines the product price' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveProductVariationDto)
  variations!: SaveProductVariationDto[];
}

export class UpdateVendorStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: PermissionScope })
  @IsOptional()
  @IsEnum(PermissionScope)
  scope?: PermissionScope;

  @ApiPropertyOptional({ description: 'Target brand when switching to ALL_OUTLETS_MASTER' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Target outlet when switching to PARTICULAR_OUTLET' })
  @IsOptional()
  @IsString()
  vendorId?: string;
}

export class UpdateStaffAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'phone must be a valid phone number' })
  phone?: string;
}

export class UpdateOperatingHoursDto {
  @ApiProperty({ type: 'array' })
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDayDto)
  hours!: OperatingHourDayDto[];
}

class OperatingHourDayDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openTime!: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closeTime!: string;

  @ApiProperty()
  @IsBoolean()
  isClosed!: boolean;
}

export class CreateOutletCategoryDto {
  @ApiProperty({ example: 'Signature Burgers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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

export class GetRidersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'ALL'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'ALL'])
  approvalStatus?: 'PENDING' | 'APPROVED' | 'ALL';

  @ApiPropertyOptional({
    enum: ['ONLINE', 'ON_TRIP', 'OFFLINE'],
    description: 'Derived duty status filter — ignored while the applicant (PENDING) queue is active',
  })
  @IsOptional()
  @IsIn(['ONLINE', 'ON_TRIP', 'OFFLINE'])
  status?: 'ONLINE' | 'ON_TRIP' | 'OFFLINE';

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isOnline?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Search term for courier name, phone, or vehicle type' })
  @IsOptional()
  @IsString()
  search?: string;

  get isOnlineParsed(): boolean | undefined {
    return this.isOnline !== undefined ? this.isOnline === 'true' : undefined;
  }
}
