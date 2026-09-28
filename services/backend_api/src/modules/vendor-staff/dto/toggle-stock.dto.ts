import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleStockDto {
  @ApiProperty({
    description: 'Instant stock availability toggle',
    example: false,
  })
  @IsBoolean()
  isInStock!: boolean;
}
