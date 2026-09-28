import { IsEnum, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VendorVertical } from '@prisma/client';

export class GetNearbyVendorsDto {
  @ApiProperty({ example: 23.7937, description: 'Customer current latitude' })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 90.4043, description: 'Customer current longitude' })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ enum: VendorVertical, description: 'Filter by vendor vertical' })
  @IsOptional()
  @IsEnum(VendorVertical)
  vertical?: VendorVertical;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50, description: 'Maximum outlets returned' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
