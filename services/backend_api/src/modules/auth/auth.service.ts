import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ISmsService, SMS_SERVICE } from './sms/sms.interface';
import { requiredEnv } from '../../common/config/env';
import { AccountStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(SMS_SERVICE) private readonly smsService: ISmsService,
  ) {}

  async requestOtp(dto: RequestOtpDto): Promise<{ retryAfterSeconds: number }> {
    const { phone } = dto;
    const rateLimitKey = `ratelimit:otp:${phone}`;
    const attempts = await this.redis.get(rateLimitKey);

    if (attempts && parseInt(attempts, 10) >= 3) {
      throw new HttpException(
        'Too many OTP requests. Please wait before retrying.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isMock = process.env.SMS_PROVIDER === 'mock' || !process.env.SMS_PROVIDER;
    const staticOtp = process.env.SMS_MOCK_STATIC_OTP;
    const otp = isMock && staticOtp ? staticOtp : Math.floor(100000 + Math.random() * 900000).toString();

    // Cache OTP in Redis for 5 minutes (300 seconds)
    const otpKey = `otp:${phone}`;
    await this.redis.set(otpKey, otp, 300);

    // Increment rate limit counter with 5 min expiry
    const newAttempts = attempts ? parseInt(attempts, 10) + 1 : 1;
    await this.redis.set(rateLimitKey, newAttempts.toString(), 300);

    // Save requested role temporarily in case user is new
    if (dto.role) {
      await this.redis.set(`role_req:${phone}`, dto.role, 300);
    }

    // Send SMS
    await this.smsService.sendOtp(phone, otp);

    return { retryAfterSeconds: 60 };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{
    user: {
      id: string;
      phone: string;
      fullName: string;
      role: UserRole;
      status: AccountStatus;
    };
    accessToken: string;
    refreshToken: string;
  }> {
    const { phone, otp, fullName } = dto;
    const otpKey = `otp:${phone}`;
    const cachedOtp = await this.redis.get(otpKey);
    const staticOtp = process.env.SMS_MOCK_STATIC_OTP;
    const isMock = process.env.SMS_PROVIDER === 'mock' || !process.env.SMS_PROVIDER;
    const allowStatic = process.env.NODE_ENV !== 'production' && isMock;

    const isValid = (cachedOtp && cachedOtp === otp) || (allowStatic && otp === staticOtp);

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Remove OTP from Redis
    await this.redis.del(otpKey);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      const requestedRole = (await this.redis.get(`role_req:${phone}`)) as UserRole | null;
      const role = requestedRole || UserRole.CUSTOMER;
      const status = role === UserRole.RIDER ? AccountStatus.PENDING_APPROVAL : AccountStatus.ACTIVE;

      user = await this.prisma.user.create({
        data: {
          phone,
          fullName: fullName || (role === UserRole.RIDER ? 'New Rider' : 'New Customer'),
          role,
          status,
        },
      });

      if (role === UserRole.RIDER) {
        await this.prisma.rider.create({
          data: {
            userId: user.id,
            vehicleType: 'motorcycle',
            isOnline: false,
          },
        });
      }
    }

    // Enforce approved login status
    if (user.status === AccountStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Your account is currently pending administrator approval.');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended. Please contact support.');
    }

    // Generate JWT Tokens
    const secret = requiredEnv('JWT_SECRET');
    const refreshSecret = requiredEnv('JWT_REFRESH_SECRET');

    const accessToken = jwt.sign(
      {
        sub: user.id,
        phone: user.phone,
        role: user.role,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
      },
      refreshSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' } as jwt.SignOptions,
    );

    return {
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }
}
