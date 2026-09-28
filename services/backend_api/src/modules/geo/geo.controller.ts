import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GeoService } from './geo.service';

@ApiTags('Geolocation')
@Controller('geo')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('reverse-geocode')
  @ApiOperation({ summary: 'Reverse geocode coordinates to human-readable address with 24h Redis cache' })
  @ApiQuery({ name: 'lat', type: Number, required: true, example: 23.7937 })
  @ApiQuery({ name: 'lng', type: Number, required: true, example: 90.4043 })
  @ApiResponse({ status: 200, description: 'Geocoded address payload' })
  async reverseGeocode(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
  ) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException('lat and lng query parameters must be valid numbers');
    }

    const data = await this.geoService.reverseGeocode(lat, lng);
    return {
      message: 'Reverse geocode successful',
      data,
    };
  }
}
