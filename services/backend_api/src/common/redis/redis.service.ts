import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { requiredEnv } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  // Created eagerly in the constructor: the WebSocket gateway's afterInit runs
  // before Nest's onModuleInit hooks and already needs the client.
  private readonly client: Redis;
  private readonly adapterClients: Redis[] = [];

  constructor() {
    const redisUrl = requiredEnv('REDIS_URL');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async getAdapterClients(): Promise<[Redis, Redis]> {
    // Duplicates auto-connect on creation
    const [pub, sub] = [this.client.duplicate(), this.client.duplicate()];
    this.adapterClients.push(pub, sub);
    return [pub, sub];
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<string> {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async geoadd(
    key: string,
    longitude: number,
    latitude: number,
    member: string,
  ): Promise<number> {
    return this.client.geoadd(key, longitude, latitude, member);
  }

  async geosearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<Array<[member: string, distanceKm: string]>> {
    // Redis 6.2+ GEOSEARCH with distance in ascending order
    return this.client.geosearch(
      key,
      'FROMLONLAT',
      longitude,
      latitude,
      'BYRADIUS',
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
    ) as unknown as Promise<Array<[member: string, distanceKm: string]>>;
  }

  async acquireLock(
    key: string,
    value: string,
    ttlSeconds: number = 10,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    // Lua script to safely release lock only if the value matches
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(luaScript, 1, key, value);
    return result === 1;
  }

  async onModuleDestroy() {
    for (const client of this.adapterClients) {
      client.disconnect();
    }
    if (this.client) {
      await this.client.quit();
    }
  }
}
