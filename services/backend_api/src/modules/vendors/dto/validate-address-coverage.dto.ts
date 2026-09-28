import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateAddressCoverageDto {
  @ApiProperty({ example: 'c1f7a4e2-9012-4abc-9999-1234567890ab', description: 'Vendor Outlet UUID' })
  @IsUUID()
  @IsNotEmpty()
  vendorId!: string;

  @ApiPropertyOptional({ example: 'a9b8c7d6-1111-2222-3333-444455556666', description: 'Customer saved address UUID' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ example: 23.7937, description: 'Direct latitude coordinate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 90.4043, description: 'Direct longitude coordinate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}
