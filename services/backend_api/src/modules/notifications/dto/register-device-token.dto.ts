import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM Device Registration Token' })
  @IsString()
  @IsNotEmpty()
  fcmToken!: string;

  @ApiProperty({ description: 'Device Operating System / Platform', required: false, example: 'android' })
  @IsString()
  @IsOptional()
  platform?: string;
}
