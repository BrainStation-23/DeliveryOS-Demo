import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OperatingHourDayDto {
  @ApiProperty({ description: 'Day of week (0=Sunday ... 6=Saturday)', minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt({ message: 'dayOfWeek must be an integer between 0 and 6' })
  @Min(0, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  @Max(6, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Opening time in HH:mm 24-hour format', example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime must be a valid 24h time in HH:mm format' })
  openTime!: string;

  @ApiProperty({ description: 'Closing time in HH:mm 24-hour format', example: '23:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime must be a valid 24h time in HH:mm format' })
  closeTime!: string;

  @ApiProperty({ description: 'Whether the outlet is closed on this day' })
  @IsBoolean()
  isClosed!: boolean;
}

export class UpdateVendorOperatingHoursDto {
  @ApiPropertyOptional({ description: 'Optional target vendor UUID' })
  @IsOptional()
  @IsUUID('4', { message: 'vendorId must be a valid UUID' })
  vendorId?: string;

  @ApiPropertyOptional({ type: [OperatingHourDayDto], description: '7-day operating hours schedule' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDayDto)
  hours?: OperatingHourDayDto[];

  @ApiPropertyOptional({ type: [OperatingHourDayDto], description: 'Alias for hours schedule' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDayDto)
  operatingHours?: OperatingHourDayDto[];
}
