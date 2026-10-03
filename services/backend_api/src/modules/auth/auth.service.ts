import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomInt, randomUUID } from 'node:crypto';
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

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, status: true, suspensionReason: true },
    });
    if (existingUser && existingUser.status === AccountStatus.SUSPENDED) {
      const reason = existingUser.suspensionReason || 'Violation of platform policies';
      throw new ForbiddenException({
        statusCode: 403,
        error: 'ACCOUNT_SUSPENDED',
        message: `Your account has been suspended: ${reason}. Please contact customer support.`,
        reason,
      });
    }

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
    const otp = isMock && staticOtp ? staticOtp : randomInt(100000, 1000000).toString();

    // Cache OTP in Redis for 2 minutes
    const otpKey = `otp:${phone}`;
    await this.redis.set(otpKey, otp, 120);

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

    // Brute-force lockout: 5 failed verifications invalidate the code
    const attemptsKey = `otp_attempts:${phone}`;
    const attempts = parseInt((await this.redis.get(attemptsKey)) || '0', 10);
    if (cachedOtp && attempts >= 5) {
      await this.redis.del(otpKey);
      await this.redis.del(attemptsKey);
      throw new BadRequestException('Too many invalid attempts. Please request a new OTP.');
    }

    const isValid = (cachedOtp && cachedOtp === otp) || (allowStatic && Boolean(staticOtp) && otp === staticOtp);

    if (!isValid) {
      if (cachedOtp) {
        await this.redis.set(attemptsKey, (attempts + 1).toString(), 120);
      }
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Remove OTP from Redis
    await this.redis.del(otpKey);
    await this.redis.del(attemptsKey);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // Whitelist clamp: self-signup can only ever create CUSTOMER or RIDER,
      // regardless of any stale role request cached in Redis.
      const requestedRole = await this.redis.get(`role_req:${phone}`);
      const role: UserRole = requestedRole === UserRole.RIDER ? UserRole.RIDER : UserRole.CUSTOMER;
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
      const reason = user.suspensionReason || 'Violation of platform policies';
      throw new ForbiddenException({
        statusCode: 403,
        error: 'ACCOUNT_SUSPENDED',
        message: `Your account has been suspended: ${reason}. Please contact customer support.`,
        reason,
      });
    }

    // Generate JWT Tokens (access: short-lived; refresh: rotating jti stored in Redis)
    const secret = requiredEnv('JWT_SECRET');
    const refreshSecret = requiredEnv('JWT_REFRESH_SECRET');

    const accessToken = jwt.sign(
      {
        sub: user.id,
        phone: user.phone,
        role: user.role,
        type: 'access',
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions,
    );

    const refreshJti = randomUUID();
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        type: 'refresh',
        jti: refreshJti,
      },
      refreshSecret,
      { expiresIn: refreshExpiresIn } as jwt.SignOptions,
    );
    await this.redis.set(`auth:refresh:${refreshJti}`, user.id, this.parseDurationToSeconds(refreshExpiresIn));

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

  /**
   * Rotate a refresh token: validates jti against the Redis revocation store,
   * revokes the presented token, and issues a fresh pair.
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded: { sub: string; type?: string; jti?: string };
    try {
      decoded = jwt.verify(refreshToken, requiredEnv('JWT_REFRESH_SECRET')) as typeof decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.type !== 'refresh' || !decoded.jti || !decoded.sub) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    const storeKey = `auth:refresh:${decoded.jti}`;
    const storedUserId = await this.redis.get(storeKey);
    if (!storedUserId || storedUserId !== decoded.sub) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || user.status !== 'ACTIVE') {
      await this.redis.del(storeKey);
      if (user?.status === AccountStatus.SUSPENDED) {
        const reason = user.suspensionReason || 'Violation of platform policies';
        throw new UnauthorizedException({
          statusCode: 401,
          error: 'ACCOUNT_SUSPENDED',
          message: `Your account has been suspended: ${reason}. Please contact customer support.`,
          reason,
        });
      }
      throw new UnauthorizedException('User account not found or inactive');
    }

    await this.redis.del(storeKey);

    const secret = requiredEnv('JWT_SECRET');
    const refreshSecret = requiredEnv('JWT_REFRESH_SECRET');

    const accessToken = jwt.sign(
      { sub: user.id, phone: user.phone, role: user.role, type: 'access' },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions,
    );

    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const nextJti = randomUUID();
    const nextRefreshToken = jwt.sign(
      { sub: user.id, type: 'refresh', jti: nextJti },
      refreshSecret,
      { expiresIn: refreshExpiresIn } as jwt.SignOptions,
    );
    await this.redis.set(`auth:refresh:${nextJti}`, user.id, this.parseDurationToSeconds(refreshExpiresIn));

    return { accessToken, refreshToken: nextRefreshToken };
  }

  /** Revoke a refresh token (logout). Idempotent. Also purges cached user and clears FCM device token. */
  async logout(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, requiredEnv('JWT_REFRESH_SECRET')) as {
        type?: string;
        jti?: string;
        sub?: string;
      };
      if (decoded.type === 'refresh' && decoded.jti) {
        await this.redis.del(`auth:refresh:${decoded.jti}`);
      }
      if (decoded.sub) {
        await this.redis.del(`auth:user:${decoded.sub}`);
        await this.prisma.user.updateMany({
          where: { id: decoded.sub },
          data: { fcmToken: null },
        });
      }
    } catch {
      // Invalid or already-expired tokens are inherently logged out
    }
  }

  private parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) return 30 * 24 * 60 * 60;
    const value = parseInt(match[1], 10);
    const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (unitSeconds[match[2]] ?? 86400);
  }
}
