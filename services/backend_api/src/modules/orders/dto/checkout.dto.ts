import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export enum DeliveryMethod {
  HOME_DELIVERY = 'HOME_DELIVERY',
  TAKEAWAY = 'TAKEAWAY',
}

export class CheckoutItemDto {
  @ApiProperty({ example: 'b1a2c3d4-5555-4abc-8888-1234567890ab', description: 'Product UUID' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 2, description: 'Quantity of this item (min 1)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'v1a2c3d4-6666-4abc-8888-1234567890ab', description: 'Selected ProductVariant UUID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;
}

export class CheckoutDto {
  @ApiProperty({ example: 'c1f7a4e2-9012-4abc-9999-1234567890ab', description: 'Vendor Outlet UUID' })
  @IsUUID()
  @IsNotEmpty()
  vendorId!: string;

  @ApiPropertyOptional({ example: 'a9b8c7d6-1111-2222-3333-444455556666', description: 'Saved CustomerAddress UUID' })
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @ApiPropertyOptional({ enum: DeliveryMethod, default: DeliveryMethod.HOME_DELIVERY })
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod = DeliveryMethod.HOME_DELIVERY;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH_ON_DELIVERY })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH_ON_DELIVERY;

  @ApiPropertyOptional({ example: 'WELCOME50', description: 'Optional promotional coupon code' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'Please ring the doorbell upon arrival', description: 'Customer notes for kitchen/rider' })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiProperty({ type: [CheckoutItemDto], description: 'List of order items from this outlet' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}
