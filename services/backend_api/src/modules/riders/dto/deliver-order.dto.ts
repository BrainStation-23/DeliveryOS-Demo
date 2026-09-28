import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class DeliverOrderDto {
  @ApiProperty({
    description: 'Whether cash was collected from customer on delivery (for COD orders)',
    example: true,
  })
  @IsBoolean()
  codCashCollected!: boolean;

  @ApiPropertyOptional({
    description: 'Amount in cash collected from customer',
    example: 720.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountCollected?: number;
}
