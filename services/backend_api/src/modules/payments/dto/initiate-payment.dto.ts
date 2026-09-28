import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum SupportedPaymentGateway {
  SSLCOMMERZ = 'SSLCOMMERZ',
  SANDBOX = 'SANDBOX',
}

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Order UUID requiring payment' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    enum: SupportedPaymentGateway,
    default: SupportedPaymentGateway.SSLCOMMERZ,
    description: 'Target payment gateway provider',
  })
  @IsEnum(SupportedPaymentGateway)
  gateway!: SupportedPaymentGateway;

  @ApiPropertyOptional({ description: 'Optional client redirect URL after payment completion' })
  @IsOptional()
  @IsString()
  redirectUrl?: string;
}
