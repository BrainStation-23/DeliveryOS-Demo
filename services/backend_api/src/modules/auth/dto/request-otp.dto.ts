import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Roles a new phone may self-select at signup. Staff roles (VENDOR_ADMIN,
 * SUPER_ADMIN) are provisioned by administrators and can never be self-granted.
 */
export const SELF_SERVICE_ROLES = [UserRole.CUSTOMER, UserRole.RIDER] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export class RequestOtpDto {
  @ApiProperty({ example: '+8801700000005', description: 'International phone number with country prefix' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({
    enum: SELF_SERVICE_ROLES,
    default: UserRole.CUSTOMER,
    description: 'Requested onboarding role (CUSTOMER or RIDER only; staff roles are provisioned by admins)',
  })
  @IsOptional()
  @IsEnum(SELF_SERVICE_ROLES)
  role?: SelfServiceRole = UserRole.CUSTOMER;
}
