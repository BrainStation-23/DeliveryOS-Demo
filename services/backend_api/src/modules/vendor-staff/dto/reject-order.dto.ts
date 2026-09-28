import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VendorRejectReasonCode {
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  KITCHEN_OVERLOAD = 'KITCHEN_OVERLOAD',
  STORE_CLOSING_SOON = 'STORE_CLOSING_SOON',
  OUT_OF_DELIVERY_RANGE = 'OUT_OF_DELIVERY_RANGE',
  OTHER = 'OTHER',
}

export class RejectOrderDto {
  @ApiProperty({
    enum: VendorRejectReasonCode,
    example: VendorRejectReasonCode.OUT_OF_STOCK,
    description: 'Categorical reason for vendor rejecting the order',
  })
  @IsEnum(VendorRejectReasonCode)
  @IsNotEmpty()
  reasonCode!: VendorRejectReasonCode;

  @ApiPropertyOptional({
    example: 'Special seasoning is currently unavailable',
    description: 'Additional notes or explanations from kitchen staff',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reasonNotes?: string;
}
