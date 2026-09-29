import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

import { roundMoney } from '../../../common/utils/currency.util';

export interface DeliveryFeeConfig {
  mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
  flat_rate?: number;
  base_fee?: number;
  base_km?: number;
  per_km_rate?: number;
  // camelCase aliases for interoperability with admin updates
  flatFee?: number;
  baseFee?: number;
  baseKm?: number;
  perKmRate?: number;
}

export interface DeliveryEconomicsConfig {
  rider_share_percent: number;
  eta_avg_speed_kmh: number;
  eta_fallback_minutes: number;
}

@Injectable()
export class DeliveryFeeService {
  private readonly logger = new Logger(DeliveryFeeService.name);

  private readonly defaultConfig: DeliveryFeeConfig = {
    mode: 'FIXED_FLAT',
    flat_rate: 50.0,
    flatFee: 50.0,
    base_fee: 30.0,
    baseFee: 30.0,
    base_km: 2.0,
    baseKm: 2.0,
    per_km_rate: 10.0,
    perKmRate: 10.0,
  };

  private readonly defaultEconomics: DeliveryEconomicsConfig = {
    rider_share_percent: 80,
    eta_avg_speed_kmh: 25,
    eta_fallback_minutes: 10,
  };

  private cachedFeeConfig: { config: DeliveryFeeConfig; expiresAt: number } | null = null;
  private cachedEconomics: { config: DeliveryEconomicsConfig; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure calculation helper for delivery fee based on configuration and distance.
   */
  computeFee(config: DeliveryFeeConfig, distanceKm: number): number {
    const flatRate = Number(config.flat_rate ?? config.flatFee ?? 50.0);
    if (config.mode === 'FIXED_FLAT') {
      return flatRate;
    }

    const baseKm = Number(config.base_km ?? config.baseKm ?? 2.0);
    const baseFee = Number(config.base_fee ?? config.baseFee ?? 30.0);
    const perKmRate = Number(config.per_km_rate ?? config.perKmRate ?? 10.0);

    let fee = baseFee;
    if (distanceKm > baseKm) {
      const extraKm = distanceKm - baseKm;
      fee += extraKm * perKmRate;
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
        const config = setting.value as unknown as DeliveryFeeConfig;
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
