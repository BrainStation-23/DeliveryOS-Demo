import {
  DeliveryFeeConfig,
  DeliveryFeeService,
  normalizeDeliveryFeeConfig,
  PRICING_INVALIDATE_CHANNEL,
} from './delivery-fee.service';

type MockRedis = {
  publish: jest.Mock;
  subscribe: jest.Mock;
};

const noopRedis = (): MockRedis => ({
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(jest.fn()),
});

const buildService = (mockPrisma: unknown, mockRedis: MockRedis = noopRedis()): DeliveryFeeService =>
  new DeliveryFeeService(mockPrisma as never, mockRedis as never);

describe('DeliveryFeeService', () => {
  const fallbackConfig: DeliveryFeeConfig = {
    mode: 'FIXED_FLAT',
    flatFee: 50.0,
    baseFee: 30.0,
    baseKm: 2.0,
    perKmRate: 10.0,
  };

  describe('normalizeDeliveryFeeConfig', () => {
    it('returns fallback config when raw value is null or undefined', () => {
      expect(normalizeDeliveryFeeConfig(null, fallbackConfig)).toEqual(fallbackConfig);
      expect(normalizeDeliveryFeeConfig(undefined, fallbackConfig)).toEqual(fallbackConfig);
    });

    it('normalizes canonical camelCase config directly', () => {
      const raw = {
        mode: 'DISTANCE_TIERED',
        flatFee: 60.0,
        baseFee: 40.0,
        baseKm: 3.0,
        perKmRate: 15.0,
      };

      const result = normalizeDeliveryFeeConfig(raw, fallbackConfig);
      expect(result).toEqual({
        mode: 'DISTANCE_TIERED',
        flatFee: 60.0,
        baseFee: 40.0,
        baseKm: 3.0,
        perKmRate: 15.0,
      });
    });

    it('gracefully normalizes snake_case database records into canonical schema', () => {
      const rawConfig = {
        mode: 'DISTANCE_TIERED',
        flat_rate: 55.0,
        base_fee: 35.0,
        base_km: 2.5,
        per_km_rate: 12.0,
      };

      const result = normalizeDeliveryFeeConfig(rawConfig, fallbackConfig);
      expect(result).toEqual({
        mode: 'DISTANCE_TIERED',
        flatFee: 55.0,
        baseFee: 35.0,
        baseKm: 2.5,
        perKmRate: 12.0,
      });
    });
  });

  describe('computeFee', () => {
    it('returns flatFee in FIXED_FLAT mode regardless of distance', () => {
      const flatConfig: DeliveryFeeConfig = {
        mode: 'FIXED_FLAT',
        flatFee: 45.0,
        baseFee: 30.0,
        baseKm: 2.0,
        perKmRate: 10.0,
      };

      expect(buildService({}).computeFee(flatConfig, 0.5)).toBe(45.0);
      expect(buildService({}).computeFee(flatConfig, 12.0)).toBe(45.0);
    });

    it('charges exact baseFee in DISTANCE_TIERED mode when within baseKm', () => {
      const tieredConfig: DeliveryFeeConfig = {
        mode: 'DISTANCE_TIERED',
        flatFee: 50.0,
        baseFee: 40.0,
        baseKm: 2.0,
        perKmRate: 15.0,
      };

      expect(buildService({}).computeFee(tieredConfig, 1.2)).toBe(40.0);
      expect(buildService({}).computeFee(tieredConfig, 2.0)).toBe(40.0);
    });

    it('calculates incremental per-km charges when distance exceeds baseKm', () => {
      const tieredConfig: DeliveryFeeConfig = {
        mode: 'DISTANCE_TIERED',
        flatFee: 50.0,
        baseFee: 40.0,
        baseKm: 2.0,
        perKmRate: 15.0,
      };

      // 5.5 km -> 40 + (5.5 - 2.0) * 15 = 40 + 52.5 = 92.5 BDT
      expect(buildService({}).computeFee(tieredConfig, 5.5)).toBe(92.5);
    });
  });

  describe('caching and invalidateCache', () => {
    it('caches database response and immediately refreshes after invalidateCache', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              value: { mode: 'FIXED_FLAT', flatFee: 40.0 },
            })
            .mockResolvedValueOnce({
              value: { mode: 'DISTANCE_TIERED', baseFee: 60.0 },
            }),
        },
      };
      const mockRedis = noopRedis();
      const service = buildService(mockPrisma, mockRedis);

      // First fetch hits DB
      const config1 = await service.getConfig();
      expect(config1.flatFee).toBe(40.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);

      // Second fetch uses cache
      const config2 = await service.getConfig();
      expect(config2.flatFee).toBe(40.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);

      // Invalidate cache (local clear + replica broadcast)
      service.invalidateCache();
      expect(mockRedis.publish).toHaveBeenCalledWith(PRICING_INVALIDATE_CHANNEL, 'invalidate');

      // Third fetch re-queries DB
      const config3 = await service.getConfig();
      expect(config3.baseFee).toBe(60.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('multi-replica invalidation (ADR-015)', () => {
    it('subscribes on init and clears the local cache when a peer broadcasts', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ value: { mode: 'FIXED_FLAT', flatFee: 40.0 } })
            .mockResolvedValueOnce({ value: { mode: 'FIXED_FLAT', flatFee: 70.0 } }),
        },
      };
      const handlers: Array<(message: string) => void> = [];
      const mockRedis: MockRedis = {
        publish: jest.fn().mockResolvedValue(1),
        subscribe: jest.fn().mockImplementation(async (_channel: string, handler: (m: string) => void) => {
          handlers.push(handler);
          return jest.fn();
        }),
      };
      const service = buildService(mockPrisma, mockRedis);
      await service.onModuleInit();
      expect(mockRedis.subscribe).toHaveBeenCalledWith(PRICING_INVALIDATE_CHANNEL, expect.any(Function));

      await service.getConfig();
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);

      // A peer replica published an invalidation — this replica must drop its cache.
      handlers[0]('invalidate');
      await service.getConfig();
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    });

    it('keeps the already-cleared local cache when the broadcast publish fails', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ value: { mode: 'FIXED_FLAT', flatFee: 40.0 } })
            .mockResolvedValueOnce({ value: { mode: 'FIXED_FLAT', flatFee: 70.0 } }),
        },
      };
      const mockRedis: MockRedis = {
        publish: jest.fn().mockRejectedValue(new Error('redis unavailable')),
        subscribe: jest.fn().mockResolvedValue(jest.fn()),
      };
      const service = buildService(mockPrisma, mockRedis);

      await service.getConfig();
      expect(() => service.invalidateCache()).not.toThrow();
      // Local cache was still cleared even though the fan-out failed.
      await service.getConfig();
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes on module destroy', async () => {
      const unsubscribe = jest.fn();
      const mockRedis: MockRedis = {
        publish: jest.fn().mockResolvedValue(1),
        subscribe: jest.fn().mockResolvedValue(unsubscribe),
      };
      const service = buildService({}, mockRedis);

      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure fallbacks', () => {
    it('falls back to defaults when the database read throws', async () => {
      const mockPrisma = {
        systemSetting: { findUnique: jest.fn().mockRejectedValue(new Error('connection refused')) },
      };
      const service = buildService(mockPrisma);

      await expect(service.getConfig()).resolves.toEqual({
        mode: 'FIXED_FLAT',
        flatFee: 50.0,
        baseFee: 30.0,
        baseKm: 2.0,
        perKmRate: 10.0,
      });
    });

    it('falls back to defaults when no setting row exists', async () => {
      const mockPrisma = {
        systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(mockPrisma);

      const config = await service.getConfig();
      expect(config.flatFee).toBe(50.0);
      expect(config.mode).toBe('FIXED_FLAT');
    });

    it('falls back to default economics when the database read throws', async () => {
      const mockPrisma = {
        systemSetting: { findUnique: jest.fn().mockRejectedValue(new Error('timeout')) },
      };
      const service = buildService(mockPrisma);

      await expect(service.getEconomicsConfig()).resolves.toEqual({
        rider_share_percent: 80,
        eta_avg_speed_kmh: 25,
        eta_fallback_minutes: 10,
      });
    });

    it('returns stored economics config and caches it for subsequent reads', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: { rider_share_percent: 70, eta_avg_speed_kmh: 30, eta_fallback_minutes: 12 },
          }),
        },
      };
      const service = buildService(mockPrisma);

      const first = await service.getEconomicsConfig();
      expect(first.rider_share_percent).toBe(70);

      await service.getEconomicsConfig();
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateFee', () => {
    it('combines config fetch and computation into one money-path result', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: { mode: 'DISTANCE_TIERED', baseFee: 40.0, baseKm: 2.0, perKmRate: 15.0 },
          }),
        },
      };
      const service = buildService(mockPrisma);

      const result = await service.calculateFee(5.5);
      expect(result).toEqual({ deliveryFee: 92.5, mode: 'DISTANCE_TIERED', distanceKm: 5.5 });
    });
  });

  describe('computeRiderEarnings & calculateRiderEarnings', () => {
    it('computes pure rider earnings with custom or default share', () => {
      expect(buildService({}).computeRiderEarnings(100, 75)).toBe(75);
      expect(buildService({}).computeRiderEarnings(60)).toBe(48);
    });

    it('calculates rider earnings using active delivery economics setting', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: { rider_share_percent: 75 },
          }),
        },
      };
      const service = buildService(mockPrisma);
      const earnings = await service.calculateRiderEarnings(100);
      expect(earnings).toBe(75);
    });
  });
});
