import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'WELCOME50', description: 'Promotional coupon code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 500.0, description: 'Current cart items gross subtotal' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartSubtotal!: number;

  @ApiPropertyOptional({ example: 'c1f7a4e2-9012-4abc-9999-1234567890ab', description: 'Vendor Outlet UUID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;
}
