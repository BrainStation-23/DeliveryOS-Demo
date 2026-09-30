import { GeoService } from './geo.service';

describe('GeoService', () => {
  let service: GeoService;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    service = new GeoService(redis as never);
  });

  describe('reverseGeocode', () => {
    it('returns cached result when available in Redis', async () => {
      const cachedData = {
        displayName: 'House 42, Road 11, Banani, Dhaka',
        addressLine: 'House 42, Road 11, Banani',
        city: 'Dhaka',
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.reverseGeocode(23.7925, 90.4078);
      expect(result.addressLine).toBe('House 42, Road 11, Banani');
      expect(redis.get).toHaveBeenCalledWith('geo:reverse:23.7925:90.4078');
    });

    it('falls back gracefully to coordinate formatting if fetch fails', async () => {
      // global fetch is mocked or fails
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

      const result = await service.reverseGeocode(23.7925, 90.4078);
      expect(result.addressLine).toContain('GPS Location (23.7925, 90.4078)');

      global.fetch = originalFetch;
    });
  });

  describe('forwardGeocode', () => {
    it('returns empty list immediately for empty or whitespace query', async () => {
      const result = await service.forwardGeocode('   ');
      expect(result).toEqual([]);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns cached results from Redis when available', async () => {
      const cachedResults = [
        {
          displayName: 'Mirpur 10 Roundabout, Dhaka, Bangladesh',
          addressLine: 'Mirpur 10 Roundabout, Mirpur',
          latitude: 23.8067,
          longitude: 90.3683,
          city: 'Dhaka',
        },
      ];
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedResults));

      const result = await service.forwardGeocode('Mirpur 10');
      expect(result).toHaveLength(1);
      expect(result[0].latitude).toBe(23.8067);
      expect(redis.get).toHaveBeenCalledWith('geo:forward:mirpur 10');
    });

    it('parses API response and caches in Redis when cache misses', async () => {
      const apiResponse = [
        {
          lat: '23.8067',
          lon: '90.3683',
          display_name: 'Mirpur 10, Mirpur, Dhaka, Bangladesh',
          address: {
            suburb: 'Mirpur',
            city: 'Dhaka',
            country: 'Bangladesh',
          },
        },
      ];

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(apiResponse),
      } as never);

      const result = await service.forwardGeocode('Mirpur 10');
      expect(result).toHaveLength(1);
      expect(result[0].latitude).toBe(23.8067);
      expect(result[0].longitude).toBe(90.3683);
      expect(redis.set).toHaveBeenCalled();

      global.fetch = originalFetch;
    });
  });
});
