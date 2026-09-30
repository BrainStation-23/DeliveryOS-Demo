import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class ToggleDutyDto {
  @ApiProperty({
    description: 'Toggle duty state: true = online (active on radar), false = offline',
    example: true,
  })
  @IsBoolean()
  isOnline!: boolean;

  @ApiPropertyOptional({ description: 'Rider GPS latitude for location fallback', example: 23.7808 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Rider GPS longitude for location fallback', example: 90.4152 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Rider speed in km/h or m/s', example: 15.5 })
  @IsOptional()
  @IsNumber()
  speed?: number;
}
