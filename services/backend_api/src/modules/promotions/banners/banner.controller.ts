import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';

@ApiTags('Promotional Banners')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get active promotional banners for the Customer Home screen' })
  @ApiQuery({ name: 'lat', required: false, type: Number, description: 'Customer latitude for outlet geofencing' })
  @ApiQuery({ name: 'lng', required: false, type: Number, description: 'Customer longitude for outlet geofencing' })
  @ApiResponse({ status: 200, description: 'List of active promotional banners' })
  async getActiveBanners(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latNum = lat !== undefined && lat !== '' ? parseFloat(lat) : undefined;
    const lngNum = lng !== undefined && lng !== '' ? parseFloat(lng) : undefined;
    const banners = await this.bannerService.getActiveBanners(
      latNum !== undefined && !Number.isNaN(latNum) ? latNum : undefined,
      lngNum !== undefined && !Number.isNaN(lngNum) ? lngNum : undefined,
    );
    return {
      message: `Retrieved ${banners.length} active promotional banners`,
      data: banners,
    };
  }
}

