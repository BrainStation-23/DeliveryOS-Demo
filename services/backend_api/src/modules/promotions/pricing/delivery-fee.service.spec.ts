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
});
