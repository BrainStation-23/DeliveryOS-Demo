import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VendorService } from './vendor.service';
import { GetNearbyVendorsDto } from './dto/get-nearby-vendors.dto';
import { SearchVendorsDto } from './dto/search-vendors.dto';
import { ValidateAddressCoverageDto } from './dto/validate-address-coverage.dto';

@ApiTags('Vendors & Discovery')
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby active outlets within delivery coverage' })
  @ApiResponse({ status: 200, description: 'List of outlets within delivery radius' })
  async getNearbyVendors(@Query() dto: GetNearbyVendorsDto) {
    const outlets = await this.vendorService.getNearbyVendors(dto);
    return {
      message: `Found ${outlets.length} active outlets serving this location`,
      data: outlets,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search outlets and dishes/items available within delivery coverage' })
  @ApiResponse({ status: 200, description: 'Matching outlets and menu items' })
  async search(@Query() dto: SearchVendorsDto) {
    const results = await this.vendorService.search(dto);
    return {
      message: 'Search results retrieved successfully',
      data: results,
    };
  }

  @Get(':id/catalog')
  @ApiOperation({ summary: 'Get outlet details, categories, items, variants, and toppings' })
  @ApiResponse({ status: 200, description: 'Full categorized outlet menu catalog' })
  async getCatalog(@Param('id') id: string) {
    const catalog = await this.vendorService.getCatalog(id);
    return {
      message: 'Outlet catalog retrieved successfully',
      data: catalog,
    };
  }

  @Post('validate-address-coverage')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validate if an address coordinate is within outlet delivery coverage' })
  @ApiResponse({ status: 200, description: 'Address is strictly within coverage radius' })
  @ApiResponse({ status: 422, description: 'Address is outside outlet coverage radius' })
  async validateCoverage(@Body() dto: ValidateAddressCoverageDto) {
    const result = await this.vendorService.validateAddressCoverage(dto);
    return {
      message: 'Address is within outlet delivery coverage',
      data: result,
    };
  }
}

@ApiTags('Cart & Checkout')
@Controller('cart')
export class CartController {
  constructor(private readonly vendorService: VendorService) {}

  @Post('validate-address-coverage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cart Address Geofence Guard: Verify delivery address coverage' })
  @ApiResponse({ status: 200, description: 'Address is strictly within coverage radius' })
  @ApiResponse({ status: 422, description: 'Address is outside outlet coverage radius' })
  async validateCartCoverage(@Body() dto: ValidateAddressCoverageDto) {
    const result = await this.vendorService.validateAddressCoverage(dto);
    return {
      message: 'Address is within outlet delivery coverage',
      data: result,
    };
  }
}
