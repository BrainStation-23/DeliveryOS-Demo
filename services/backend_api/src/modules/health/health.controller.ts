import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@ApiTags('System Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Platform operational health check for database and Redis services' })
  @ApiResponse({ status: 200, description: 'All core infrastructure services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more infrastructure services are unhealthy' })
  async checkHealth(@Res() res: Response) {
    const healthStatus: {
      status: 'healthy' | 'unhealthy';
      timestamp: string;
      uptime: number;
      services: {
        database: 'up' | 'down';
        redis: 'up' | 'down';
      };
      details?: {
        dbLatencyMs?: number;
        redisLatencyMs?: number;
        error?: string;
      };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      services: {
        database: 'down',
        redis: 'down',
      },
      details: {},
    };

    let isHealthy = true;

    // 1. Check PostgreSQL Database Connection
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      healthStatus.services.database = 'up';
      healthStatus.details!.dbLatencyMs = Date.now() - dbStart;
    } catch (err) {
      isHealthy = false;
      healthStatus.services.database = 'down';
      healthStatus.details!.error = `Database check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // 2. Check Redis In-Memory Cache Connection
    try {
      const redisStart = Date.now();
      const pong = await this.redis.getClient().ping();
      if (pong === 'PONG') {
        healthStatus.services.redis = 'up';
        healthStatus.details!.redisLatencyMs = Date.now() - redisStart;
      } else {
        isHealthy = false;
        healthStatus.services.redis = 'down';
      }
    } catch (err) {
      isHealthy = false;
      healthStatus.services.redis = 'down';
      healthStatus.details!.error = (healthStatus.details!.error ? `${healthStatus.details!.error}; ` : '') +
        `Redis check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    healthStatus.status = isHealthy ? 'healthy' : 'unhealthy';
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(healthStatus);
  }
}
