import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued by /auth/otp/verify or a previous refresh' })
  @IsJWT()
  refreshToken!: string;
}
