import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCancelOrderDto {
  @ApiProperty({
    example: 'Customer phone unreachable and delivery location unserviceable',
    description: 'Mandatory administrative cancellation reason for audit trails',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
