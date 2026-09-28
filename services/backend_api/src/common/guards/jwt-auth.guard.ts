import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { requiredEnv } from '../config/env';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          vendorStaff: true,
          rider: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User account not found or inactive');
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
