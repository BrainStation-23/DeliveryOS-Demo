import { IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description: 'Filter by outlet type slug (from GET /vendors/outlet-types)',
    example: 'restaurant',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'typeSlug must be lowercase kebab-case' })
  typeSlug?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50, description: 'Maximum outlets returned' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
