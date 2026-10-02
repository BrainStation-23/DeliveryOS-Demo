import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum OrderFlowMode {
  RIDER_FIRST = 'RIDER_FIRST',
  VENDOR_FIRST = 'VENDOR_FIRST',
}

export class UpdateOrderFlowDto {
  @ApiProperty({
    description: 'Order fulfillment dispatch mode',
    enum: OrderFlowMode,
    example: OrderFlowMode.RIDER_FIRST,
  })
  @IsEnum(OrderFlowMode)
  mode!: OrderFlowMode;

  @ApiPropertyOptional({
    description: 'Timeout in seconds before searching in wider radius or alerting dispatch',
    example: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(600)
  riderSearchTimeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Minutes before a stuck unassigned order is auto-cancelled by the stale-order sweep',
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  staleOrderTtlMinutes?: number;
}
