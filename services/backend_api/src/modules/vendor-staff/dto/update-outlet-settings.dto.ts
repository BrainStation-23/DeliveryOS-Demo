import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateOutletSettingsDto {
  @ApiPropertyOptional({ description: 'Optional target vendor UUID (if multi-outlet manager)' })
  @IsOptional()
  @IsUUID('4', { message: 'vendorId must be a valid UUID' })
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Default preparation time in minutes', minimum: 1, maximum: 180 })
  @IsOptional()
  @IsInt({ message: 'defaultPrepTimeMinutes must be an integer' })
  @Min(1, { message: 'defaultPrepTimeMinutes must be at least 1 minute' })
  @Max(180, { message: 'defaultPrepTimeMinutes cannot exceed 180 minutes' })
  defaultPrepTimeMinutes?: number;

  @ApiPropertyOptional({ description: 'Emergency rush-hour pause toggle' })
  @IsOptional()
  @IsBoolean()
  isBusy?: boolean;

  @ApiPropertyOptional({ description: 'Outlet active status toggle' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional operational reason for busy toggle' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  busyReason?: string;
}
