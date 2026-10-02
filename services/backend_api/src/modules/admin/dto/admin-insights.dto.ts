import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SettlementStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class GetAnalyticsOverviewQueryDto {
  @ApiPropertyOptional({ description: 'ISO-8601 inclusive lower bound on placedAt (defaults to 30 days ago)' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 inclusive upper bound on placedAt (defaults to now)' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['day', 'hour'], default: 'day', description: 'Timeseries bucket granularity' })
  @IsOptional()
  @IsIn(['day', 'hour'])
  granularity?: 'day' | 'hour';
}

export class GetOrdersSummaryQueryDto {
  @ApiPropertyOptional({ description: 'ISO-8601 inclusive lower bound on placedAt' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 inclusive upper bound on placedAt' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search term for order number, customer name, or customer phone' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class GetCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search term for customer name or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'ALL'], description: 'Account status filter' })
  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'ALL'])
  status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'ALL';

  @ApiPropertyOptional({ description: 'ISO-8601 lower bound on account registration date' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 upper bound on account registration date' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}

export class GetFinanceLedgerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ISO-8601 inclusive lower bound on order placedAt' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 inclusive upper bound on order placedAt' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search term for order number, outlet name, or rider name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SettlementStatus, description: 'Settlement lifecycle filter' })
  @IsOptional()
  @IsEnum(SettlementStatus)
  settlementStatus?: SettlementStatus;
}

export class GetBrandsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Brand name search term' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateDeliveryEconomicsDto {
  @ApiProperty({ example: 80, minimum: 0, maximum: 100, description: 'Rider share of the delivery fee (percent)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  riderSharePercent!: number;

  @ApiProperty({ example: 25, minimum: 5, maximum: 120, description: 'Average courier speed used for ETA computation (km/h)' })
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(120)
  etaAvgSpeedKmh!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 120, description: 'Fallback ETA when no route estimate exists (minutes)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  etaFallbackMinutes!: number;
}
