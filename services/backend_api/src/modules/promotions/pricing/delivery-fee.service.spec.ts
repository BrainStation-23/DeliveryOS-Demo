import {
  DeliveryFeeConfig,
  DeliveryFeeService,
  normalizeDeliveryFeeConfig,
} from './delivery-fee.service';

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

    it('gracefully normalizes legacy snake_case database records into canonical schema', () => {
      const legacyRaw = {
        mode: 'DISTANCE_TIERED',
        flat_rate: 55.0,
        base_fee: 35.0,
        base_km: 2.5,
        per_km_rate: 12.0,
      };

      const result = normalizeDeliveryFeeConfig(legacyRaw, fallbackConfig);
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
    const service = new DeliveryFeeService({} as never);

    it('returns flatFee in FIXED_FLAT mode regardless of distance', () => {
      const flatConfig: DeliveryFeeConfig = {
        mode: 'FIXED_FLAT',
        flatFee: 45.0,
        baseFee: 30.0,
        baseKm: 2.0,
        perKmRate: 10.0,
      };

      expect(service.computeFee(flatConfig, 0.5)).toBe(45.0);
      expect(service.computeFee(flatConfig, 12.0)).toBe(45.0);
    });

    it('charges exact baseFee in DISTANCE_TIERED mode when within baseKm', () => {
      const tieredConfig: DeliveryFeeConfig = {
        mode: 'DISTANCE_TIERED',
        flatFee: 50.0,
        baseFee: 40.0,
        baseKm: 2.0,
        perKmRate: 15.0,
      };

      expect(service.computeFee(tieredConfig, 1.2)).toBe(40.0);
      expect(service.computeFee(tieredConfig, 2.0)).toBe(40.0);
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
      expect(service.computeFee(tieredConfig, 5.5)).toBe(92.5);
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

      const service = new DeliveryFeeService(mockPrisma as never);

      // First fetch hits DB
      const config1 = await service.getConfig();
      expect(config1.flatFee).toBe(40.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);

      // Second fetch uses cache
      const config2 = await service.getConfig();
      expect(config2.flatFee).toBe(40.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);

      // Invalidate cache
      service.invalidateCache();

      // Third fetch re-queries DB
      const config3 = await service.getConfig();
      expect(config3.baseFee).toBe(60.0);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure fallbacks', () => {
    it('falls back to defaults when the database read throws', async () => {
      const mockPrisma = {
        systemSetting: { findUnique: jest.fn().mockRejectedValue(new Error('connection refused')) },
      };
      const service = new DeliveryFeeService(mockPrisma as never);

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
      const service = new DeliveryFeeService(mockPrisma as never);

      const config = await service.getConfig();
      expect(config.flatFee).toBe(50.0);
      expect(config.mode).toBe('FIXED_FLAT');
    });

    it('falls back to default economics when the database read throws', async () => {
      const mockPrisma = {
        systemSetting: { findUnique: jest.fn().mockRejectedValue(new Error('timeout')) },
      };
      const service = new DeliveryFeeService(mockPrisma as never);

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
      const service = new DeliveryFeeService(mockPrisma as never);

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
      const service = new DeliveryFeeService(mockPrisma as never);

      const result = await service.calculateFee(5.5);
      expect(result).toEqual({ deliveryFee: 92.5, mode: 'DISTANCE_TIERED', distanceKm: 5.5 });
    });
  });

  describe('computeRiderEarnings & calculateRiderEarnings', () => {
    it('computes pure rider earnings with custom or default share', () => {
      const service = new DeliveryFeeService({} as never);
      expect(service.computeRiderEarnings(100, 75)).toBe(75);
      expect(service.computeRiderEarnings(60)).toBe(48);
    });

    it('calculates rider earnings using active delivery economics setting', async () => {
      const mockPrisma = {
        systemSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: { rider_share_percent: 75 },
          }),
        },
      };
      const service = new DeliveryFeeService(mockPrisma as never);
      const earnings = await service.calculateRiderEarnings(100);
      expect(earnings).toBe(75);
    });
  });
});

