import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleDutyDto {
  @ApiProperty({
    description: 'Toggle duty state: true = online (active on radar), false = offline',
    example: true,
  })
  @IsBoolean()
  isOnline!: boolean;
}
