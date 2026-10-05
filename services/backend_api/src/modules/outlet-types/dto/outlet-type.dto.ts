import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOutletTypeDto {
  @ApiProperty({ description: 'Business type display name', example: 'Restaurant' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'URL-safe identifier; derived from the name when omitted',
    example: 'restaurant',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (letters, digits, single dashes)',
  })
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Chip ordering in the customer app (lower first)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Deactivated types hide all their outlets from customers' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOutletTypeDto {
  @ApiPropertyOptional({ description: 'Business type display name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'URL-safe identifier' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (letters, digits, single dashes)',
  })
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Chip ordering in the customer app (lower first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Toggling off hides every outlet of this type from customer discovery' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
