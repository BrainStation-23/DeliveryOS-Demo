import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VendorService } from './vendor.service';
import { GetNearbyVendorsDto } from './dto/get-nearby-vendors.dto';
import { SearchVendorsDto } from './dto/search-vendors.dto';
import { ValidateAddressCoverageDto } from './dto/validate-address-coverage.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Vendors & Discovery')
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get('outlet-types')
  @ApiOperation({ summary: 'Active outlet types for customer category chips (deactivated types hidden)' })
  @ApiResponse({ status: 200, description: 'Active outlet types ordered by sortOrder' })
  async getOutletTypes() {
    const data = await this.vendorService.getOutletTypes();
    return { message: `Found ${data.length} active outlet type(s)`, data };
  }

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validate if an address coordinate is within outlet delivery coverage' })
  @ApiResponse({ status: 200, description: 'Address is strictly within coverage radius' })
  @ApiResponse({ status: 422, description: 'Address is outside outlet coverage radius' })
  async validateCoverage(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: ValidateAddressCoverageDto,
  ) {
    const result = await this.vendorService.validateAddressCoverage(dto, userId);
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cart Address Geofence Guard: Verify delivery address coverage' })
  @ApiResponse({ status: 200, description: 'Address is strictly within coverage radius' })
  @ApiResponse({ status: 422, description: 'Address is outside outlet coverage radius' })
  async validateCartCoverage(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: ValidateAddressCoverageDto,
  ) {
    const result = await this.vendorService.validateAddressCoverage(dto, userId);
    return {
      message: 'Address is within outlet delivery coverage',
      data: result,
    };
  }
}
