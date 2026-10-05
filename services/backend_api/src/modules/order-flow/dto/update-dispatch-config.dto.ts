import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateDispatchConfigDto {
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
