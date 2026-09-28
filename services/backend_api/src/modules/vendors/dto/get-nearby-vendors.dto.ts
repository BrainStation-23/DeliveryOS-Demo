import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional } from 'class-validator';
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
}
