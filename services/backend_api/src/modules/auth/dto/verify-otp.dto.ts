import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+8801700000005', description: 'International phone number' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123456', description: '4 to 6 digit SMS OTP' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  otp!: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name for new user registration' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
