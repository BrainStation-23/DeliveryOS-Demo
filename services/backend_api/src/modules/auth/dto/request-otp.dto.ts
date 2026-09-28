import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '+8801700000005', description: 'International phone number with country prefix' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.CUSTOMER, description: 'Requested onboarding role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.CUSTOMER;
}
