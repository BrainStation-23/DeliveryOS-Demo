import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface ReverseGeocodeResult {
  displayName: string;
  addressLine: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export interface ForwardGeocodeResult {
  displayName: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  city?: string;
  postcode?: string;
  country?: string;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly redis: RedisService) {}

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    // Round to 4 decimal places (~11m precision) for cache optimization
    const rLat = lat.toFixed(4);
    const rLng = lng.toFixed(4);
    const cacheKey = `geo:reverse:${rLat}:${rLng}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Continue to fresh fetch on parse error
      }
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DeliveryOS/1.0 (engineering@deliveryos.internal)',
          'Accept-Language': 'en',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        const road = address.road || address.pedestrian || address.suburb || address.neighbourhood || '';
        const houseNumber = address.house_number ? `${address.house_number}, ` : '';
        const area = address.suburb || address.neighbourhood || address.residential || '';
        const city = address.city || address.town || address.county || 'Dhaka';

        const addressLine = road
          ? `${houseNumber}${road}, ${area}`.replace(/^, |, $/g, '').trim()
          : data.display_name?.split(',').slice(0, 2).join(',') || 'Current Location';

        const result: ReverseGeocodeResult = {
          displayName: data.display_name || addressLine,
          addressLine: addressLine || 'Selected Location',
          city,
          postcode: address.postcode,
          country: address.country,
        };

        // Cache in Redis for 24 hours (86400s)
        await this.redis.set(cacheKey, JSON.stringify(result), 86400);
        return result;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Reverse geocode failed for ${lat},${lng}: ${msg}`);
    }

    // Graceful fallback to formatted coordinates if external lookup fails
    return {
      displayName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      addressLine: `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: 'Dhaka',
    };
  }

  /**
   * Forward geocodes an address or neighborhood string to geographical coordinates.
   * Cached in Redis for 24 hours to minimize third-party API pressure.
   */
  async forwardGeocode(query: string): Promise<ForwardGeocodeResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = `geo:forward:${cleanQuery.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Continue on parse error
      }
    }

    try {
      // Append country context if not already specified to bias results accurately
      const searchQuery = cleanQuery.toLowerCase().includes('bangladesh')
        ? cleanQuery
        : `${cleanQuery}, Bangladesh`;
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DeliveryOS/1.0 (engineering@deliveryos.internal)',
          'Accept-Language': 'en',
        },
      });

      if (response.ok) {
        const list = (await response.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
          address?: Record<string, string>;
        }>;

        const results: ForwardGeocodeResult[] = list
          .map((item) => {
            const address = item.address || {};
            const road = address.road || address.pedestrian || address.suburb || address.neighbourhood || '';
            const houseNumber = address.house_number ? `${address.house_number}, ` : '';
            const area = address.suburb || address.neighbourhood || address.residential || '';
            const city = address.city || address.town || address.county || 'Dhaka';

            const addressLine = road
              ? `${houseNumber}${road}, ${area}`.replace(/^, |, $/g, '').trim()
              : item.display_name.split(',').slice(0, 2).join(',') || cleanQuery;

            return {
              displayName: item.display_name,
              addressLine: addressLine || cleanQuery,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              city,
              postcode: address.postcode,
              country: address.country,
            };
          })
          .filter((r) => !isNaN(r.latitude) && !isNaN(r.longitude));

        // Cache in Redis for 24 hours (86400s)
        await this.redis.set(cacheKey, JSON.stringify(results), 86400);
        return results;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Forward geocode failed for "${query}": ${msg}`);
    }

    return [];
  }
}
