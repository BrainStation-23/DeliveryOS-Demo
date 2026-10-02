import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

import { roundMoney } from '../../../common/utils/currency.util';

export interface DeliveryFeeConfig {
  mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
  flatFee: number;
  baseFee: number;
  baseKm: number;
  perKmRate: number;
}

export interface DeliveryEconomicsConfig {
  rider_share_percent: number;
  eta_avg_speed_kmh: number;
  eta_fallback_minutes: number;
}

export function normalizeDeliveryFeeConfig(
  raw: Record<string, unknown> | null | undefined,
  fallback: DeliveryFeeConfig,
): DeliveryFeeConfig {
  if (!raw) return fallback;
  return {
    mode: raw.mode === 'DISTANCE_TIERED' ? 'DISTANCE_TIERED' : 'FIXED_FLAT',
    flatFee: Number(raw.flatFee ?? raw.flat_rate ?? fallback.flatFee),
    baseFee: Number(raw.baseFee ?? raw.base_fee ?? fallback.baseFee),
    baseKm: Number(raw.baseKm ?? raw.base_km ?? fallback.baseKm),
    perKmRate: Number(raw.perKmRate ?? raw.per_km_rate ?? fallback.perKmRate),
  };
}

/** Canonical fallback pricing used whenever no delivery_fee_config row exists.
 *  Exported so the admin settings page and the pricing engine can never drift
 *  into showing different "defaults". */
export const DEFAULT_DELIVERY_FEE_CONFIG: DeliveryFeeConfig = {
  mode: 'FIXED_FLAT',
  flatFee: 50.0,
  baseFee: 30.0,
  baseKm: 2.0,
  perKmRate: 10.0,
};

/** Canonical fallback economics — exported so the admin settings surface and
 *  the pricing engine can never drift into different "defaults". */
export const DEFAULT_DELIVERY_ECONOMICS: DeliveryEconomicsConfig = {
  rider_share_percent: 80,
  eta_avg_speed_kmh: 25,
  eta_fallback_minutes: 10,
};

@Injectable()
export class DeliveryFeeService {
  private readonly logger = new Logger(DeliveryFeeService.name);

  private readonly defaultConfig: DeliveryFeeConfig = DEFAULT_DELIVERY_FEE_CONFIG;

  private readonly defaultEconomics: DeliveryEconomicsConfig = DEFAULT_DELIVERY_ECONOMICS;

  private cachedFeeConfig: { config: DeliveryFeeConfig; expiresAt: number } | null = null;
  private cachedEconomics: { config: DeliveryEconomicsConfig; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clears in-memory cache for pricing and economics configurations.
   */
  invalidateCache(): void {
    this.cachedFeeConfig = null;
    this.cachedEconomics = null;
    this.logger.log('Delivery fee and economics cache invalidated.');
  }

  /**
   * Pure calculation helper for delivery fee based on configuration and distance.
   */
  computeFee(config: DeliveryFeeConfig, distanceKm: number): number {
    if (config.mode === 'FIXED_FLAT') {
      return config.flatFee;
    }

    let fee = config.baseFee;
    if (distanceKm > config.baseKm) {
      const extraKm = distanceKm - config.baseKm;
      fee += extraKm * config.perKmRate;
    }

    return roundMoney(fee);
  }

  /**
   * Fetches the active delivery fee configuration from system_settings with 60s cache.
   */
  async getConfig(): Promise<DeliveryFeeConfig> {
    const now = Date.now();
    if (this.cachedFeeConfig && this.cachedFeeConfig.expiresAt > now) {
      return this.cachedFeeConfig.config;
    }

    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'delivery_fee_config' },
      });
      if (setting && setting.value) {
        const config = normalizeDeliveryFeeConfig(
          setting.value as Record<string, unknown>,
          this.defaultConfig,
        );
        this.cachedFeeConfig = { config, expiresAt: now + 60000 };
        return config;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not load delivery_fee_config from database, using defaults: ${msg}`);
    }
    return this.defaultConfig;
  }

  /**
   * Fetches the active delivery economics configuration with 60s cache.
   */
  async getEconomicsConfig(): Promise<DeliveryEconomicsConfig> {
    const now = Date.now();
    if (this.cachedEconomics && this.cachedEconomics.expiresAt > now) {
      return this.cachedEconomics.config;
    }

    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'delivery_economics' },
      });
      if (setting && setting.value) {
        const config = setting.value as unknown as DeliveryEconomicsConfig;
        this.cachedEconomics = { config, expiresAt: now + 60000 };
        return config;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not load delivery_economics from database, using defaults: ${msg}`);
    }
    return this.defaultEconomics;
  }

  /**
   * Calculates delivery fee based on active system setting and distance in km
   */
  async calculateFee(distanceKm: number): Promise<{
    deliveryFee: number;
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    distanceKm: number;
  }> {
    const config = await this.getConfig();
    const deliveryFee = this.computeFee(config, distanceKm);
    return {
      deliveryFee,
      mode: config.mode,
      distanceKm,
    };
  }
}
