import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CashDepositAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class VerifyCashDepositDto {
  @ApiProperty({
    enum: CashDepositAction,
    description: 'Verification action to execute on pending cash deposit',
    example: CashDepositAction.APPROVE,
  })
  @IsEnum(CashDepositAction)
  action!: CashDepositAction;

  @ApiPropertyOptional({
    description: 'Optional admin verification note or audit trail',
    example: 'Bank transfer verified against platform custody account statement',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
