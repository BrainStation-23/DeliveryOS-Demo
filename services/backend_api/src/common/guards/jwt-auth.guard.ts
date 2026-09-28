import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { requiredEnv } from '../config/env';

const USER_CACHE_TTL_SECONDS = 30;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const secret = requiredEnv('JWT_SECRET');

    try {
      const decoded = jwt.verify(token, secret) as { sub: string; role: string; type?: string };
      if (decoded.type === 'refresh') {
        throw new UnauthorizedException('Refresh tokens cannot be used for API access');
      }

      const cacheKey = `auth:user:${decoded.sub}`;
      let user = await this.getCachedUser(cacheKey);

      if (!user) {
        user = await this.prisma.user.findUnique({
          where: { id: decoded.sub },
          include: {
            vendorStaff: true,
            rider: true,
          },
        });

        if (!user || user.status !== 'ACTIVE') {
          throw new UnauthorizedException('User account not found or inactive');
        }

        // Short TTL: role/status revocations take effect within 30s at worst
        await this.redis.set(cacheKey, JSON.stringify(user), USER_CACHE_TTL_SECONDS);
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async getCachedUser(cacheKey: string): Promise<Record<string, unknown> | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? (JSON.parse(cached) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}
