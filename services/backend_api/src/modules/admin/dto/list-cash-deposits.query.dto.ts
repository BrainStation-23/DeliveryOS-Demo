import { CashDepositStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class ListCashDepositsQueryDto {
  @ApiPropertyOptional({
    enum: CashDepositStatus,
    description: 'Filter deposits by verification status; omit to list all',
    example: CashDepositStatus.PENDING_APPROVAL,
  })
  @IsOptional()
  @IsEnum(CashDepositStatus)
  status?: CashDepositStatus;
}
