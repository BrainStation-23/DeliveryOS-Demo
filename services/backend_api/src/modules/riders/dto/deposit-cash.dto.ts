import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositCashDto {
  @ApiProperty({ description: 'Amount of cash deposited in BDT', example: 500 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Optional deposit reference number or bank slip id' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ description: 'Optional deposit note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Optional deposit note alias' })
  @IsOptional()
  @IsString()
  notes?: string;
}

