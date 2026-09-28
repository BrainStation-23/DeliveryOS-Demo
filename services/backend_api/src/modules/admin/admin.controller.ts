import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { StorageService } from '../../common/storage/storage.service';
import { BannerLinkType, DiscountType, PermissionScope, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { VerifyCashDepositDto } from './dto/verify-cash-deposit.dto';

@ApiTags('Super Admin Master Governance')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly storageService: StorageService,
  ) {}

  // 0. Media Uploads
  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a promotional image (JPEG/PNG/WebP/GIF, max 5 MB)' })
  @ApiResponse({ status: 201, description: 'Stored image URL' })
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Multipart field "file" is required');
    }
    const stored = await this.storageService.saveImage(file);
    return {
      message: 'Image uploaded successfully',
      data: stored,
    };
  }

  // 1. Dashboard Overview
  @Get('overview')
  @ApiOperation({ summary: 'Get overall platform operational KPIs and summary metrics' })
  @ApiResponse({ status: 200, description: 'Platform statistics and recent orders' })
  async getOverview() {
    const data = await this.adminService.getOverviewStats();
    return {
      message: 'Platform overview metrics retrieved',
      data,
    };
  }

  // 2. Fleet Radar
  @Get('fleet')
  @ApiOperation({ summary: 'Get live rider fleet status, GPS coordinates, and cash safety margins' })
  @ApiResponse({ status: 200, description: 'Live fleet radar data' })
  async getFleet() {
    const data = await this.adminService.getFleetRadar();
    return {
      message: `Retrieved ${data.length} riders in fleet radar`,
      data,
    };
  }

  @Patch('riders/:id/cash-limit')
  @ApiOperation({ summary: 'Update rider maximum COD cash collection threshold' })
  async updateCashLimit(
    @Param('id') id: string,
    @Body('maxCashLimit') maxCashLimit: number,
  ) {
    const updated = await this.adminService.updateRiderCashLimit(id, maxCashLimit);
    return {
      message: 'Rider cash safety limit updated',
      data: updated,
    };
  }

  // 3. Live Order Monitor & Force-Assign Override
  @Get('orders')
  @ApiOperation({ summary: 'Get paginated live orders queue across all lifecycle stages' })
  async getOrders(@Query('status') status?: string, @Query() pagination: PaginationQueryDto = new PaginationQueryDto()) {
    const result = await this.adminService.getLiveOrders(status, pagination);
    return {
      message: `Retrieved ${result.items.length} of ${result.total} orders in queue`,
      data: result,
    };
  }

  @Post('orders/:id/force-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin manual dispatch force-assignment override' })
  @ApiResponse({ status: 200, description: 'Rider manually assigned to order' })
  async forceAssign(
    @Param('id') orderId: string,
    @Body('riderId') riderId: string,
  ) {
    const result = await this.adminService.forceAssignRider(orderId, riderId);
    return {
      message: `Order #${result.orderNumber} successfully force-assigned to rider`,
      data: result,
    };
  }

  // 4. Promotional Banners
  @Get('banners')
  @ApiOperation({ summary: 'List all promotional banners' })
  async getBanners() {
    const data = await this.adminService.getAllBanners();
    return {
      message: `Retrieved ${data.length} promotional banners`,
      data,
    };
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create new promotional banner' })
  async createBanner(
    @Body()
    dto: {
      title: string;
      imageUrl: string;
      linkType?: BannerLinkType;
      targetId?: string;
      sortOrder?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    },
  ) {
    const banner = await this.adminService.createBanner(dto);
    return {
      message: 'Promotional banner created successfully',
      data: banner,
    };
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: 'Update or toggle promotional banner' })
  async updateBanner(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      imageUrl?: string;
      linkType?: BannerLinkType;
      targetId?: string;
      sortOrder?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    },
  ) {
    const updated = await this.adminService.updateBanner(id, dto);
    return {
      message: 'Promotional banner updated successfully',
      data: updated,
    };
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete promotional banner' })
  async deleteBanner(@Param('id') id: string) {
    const result = await this.adminService.deleteBanner(id);
    return result;
  }

  // 5. Coupon Engine
  @Get('coupons')
  @ApiOperation({ summary: 'List all promotional coupon codes and usage limits' })
  async getCoupons() {
    const data = await this.adminService.getAllCoupons();
    return {
      message: `Retrieved ${data.length} coupon codes`,
      data,
    };
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create new discount promo code' })
  async createCoupon(
    @Body()
    dto: {
      code: string;
      description?: string;
      discountType: DiscountType;
      discountValue: number;
      minOrderAmount?: number;
      maxDiscountAmount?: number;
      usageLimit?: number;
      validFrom?: Date;
      validTo?: Date;
      isActive?: boolean;
    },
  ) {
    const coupon = await this.adminService.createCoupon(dto);
    return {
      message: `Coupon code "${coupon.code}" created successfully`,
      data: coupon,
    };
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Update or toggle coupon code' })
  async updateCoupon(
    @Param('id') id: string,
    @Body()
    dto: {
      description?: string;
      discountType?: DiscountType;
      discountValue?: number;
      minOrderAmount?: number;
      maxDiscountAmount?: number;
      usageLimit?: number;
      validFrom?: Date;
      validTo?: Date;
      isActive?: boolean;
    },
  ) {
    const updated = await this.adminService.updateCoupon(id, dto);
    return {
      message: 'Coupon code updated successfully',
      data: updated,
    };
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete coupon code' })
  async deleteCoupon(@Param('id') id: string) {
    const result = await this.adminService.deleteCoupon(id);
    return result;
  }

  // 6. Vendor & Staff Scope Governance
  @Get('vendors')
  @ApiOperation({ summary: 'List all vendor outlets and staff assignments' })
  async getVendors() {
    const data = await this.adminService.getAllVendors();
    return {
      message: `Retrieved ${data.length} vendor outlets`,
      data,
    };
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Directly create new vendor outlet' })
  async createVendor(
    @Body()
    dto: {
      name: string;
      branchName?: string;
      brandId?: string;
      addressText: string;
      latitude: number;
      longitude: number;
      contactPhone: string;
      commissionRate?: number;
      defaultPrepTimeMinutes?: number;
    },
  ) {
    const vendor = await this.adminService.createVendor(dto);
    return {
      message: 'Vendor outlet created successfully',
      data: vendor,
    };
  }

  @Patch('vendors/:id')
  @ApiOperation({ summary: 'Update vendor outlet parameters (commission, radius, prep time, contact)' })
  async updateVendor(
    @Param('id') vendorId: string,
    @Body()
    dto: {
      name?: string;
      brandId?: string;
      addressText?: string;
      contactPhone?: string;
      commissionRate?: number;
      deliveryRadiusKm?: number;
      defaultPrepTimeMinutes?: number;
      isActive?: boolean;
    },
  ) {
    const updated = await this.adminService.updateVendor(vendorId, dto);
    return {
      message: 'Vendor outlet updated successfully',
      data: updated,
    };
  }

  @Patch('vendors/:id/status')
  @ApiOperation({ summary: 'Toggle vendor outlet active/suspended status' })
  async toggleVendorStatus(
    @Param('id') vendorId: string,
    @Body('isActive') isActive: boolean,
  ) {
    const updated = await this.adminService.toggleVendorStatus(vendorId, isActive);
    return {
      message: `Vendor outlet ${isActive ? 'activated' : 'suspended'} successfully`,
      data: updated,
    };
  }

  @Post('vendors/:id/staff')
  @ApiOperation({ summary: 'Assign staff user to vendor outlet with scope (Particular vs Brand Owner)' })
  async assignStaff(
    @Param('id') vendorId: string,
    @Body()
    dto: {
      userId: string;
      scope: PermissionScope;
      role?: string;
      brandId?: string;
    },
  ) {
    const staff = await this.adminService.assignVendorStaff(vendorId, dto);
    return {
      message: 'Staff user successfully assigned to vendor outlet',
      data: staff,
    };
  }

  // 7. Master Catalog Authority
  @Get('catalog/categories')
  @ApiOperation({ summary: 'List master central categories' })
  async getCategories() {
    const data = await this.adminService.getCentralCategories();
    return {
      message: `Retrieved ${data.length} central categories`,
      data,
    };
  }

  @Post('catalog/categories')
  @ApiOperation({ summary: 'Create new central category' })
  async createCategory(
    @Body()
    dto: {
      name: string;
      imageUrl?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const category = await this.adminService.createCentralCategory(dto);
    return {
      message: 'Central category created successfully',
      data: category,
    };
  }

  @Put('catalog/products/:id/override')
  @ApiOperation({ summary: 'Centrally override product details across stores' })
  async overrideProduct(
    @Param('id') productId: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      basePrice?: number;
      categoryId?: string;
      isInStock?: boolean;
    },
  ) {
    const updated = await this.adminService.overrideProduct(productId, dto);
    return {
      message: 'Product overridden successfully',
      data: updated,
    };
  }

  @Patch('catalog/products/:id/disable')
  @ApiOperation({ summary: 'Disable or re-enable product centrally' })
  async toggleProductDisable(
    @Param('id') productId: string,
    @Body('isInStock') isInStock: boolean,
  ) {
    const updated = await this.adminService.toggleProductDisable(productId, isInStock);
    return {
      message: `Product stock status updated to ${isInStock ? 'IN_STOCK' : 'OUT_OF_STOCK'}`,
      data: updated,
    };
  }

  // 8. Platform System Settings
  @Get('settings')
  @ApiOperation({ summary: 'Get current system settings and flow modes' })
  async getSettings() {
    const data = await this.adminService.getSystemSettings();
    return {
      message: 'System settings retrieved',
      data,
    };
  }

  @Patch('settings/delivery-fee')
  @ApiOperation({ summary: 'Update delivery fee mode (FIXED_FLAT vs DISTANCE_TIERED)' })
  async updateDeliveryFee(
    @Body()
    dto: {
      mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
      flatFee?: number;
      baseFee?: number;
      perKmRate?: number;
    },
  ) {
    const updated = await this.adminService.updateDeliveryFeeMode(dto);
    return {
      message: `Delivery fee mode switched to ${dto.mode}`,
      data: updated,
    };
  }

  // 9. Financial Settlements & CSV Export
  @Get('finance/settlement-export')
  @ApiOperation({ summary: 'Export financial vendor settlement statements as CSV or JSON' })
  async exportSettlements(
    @Query('format') format: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const statements = await this.adminService.getSettlementStatements(start, end);

    if (format === 'json') {
      return res.status(200).json({
        message: `Retrieved ${statements.length} vendor settlement statements`,
        data: statements,
      });
    }

    const csvContent = this.adminService.generateSettlementCsv(statements);
    const filename = `vendor-settlements-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  }

  // 10. Rider Fleet Approval & Governance
  @Get('riders')
  @ApiOperation({ summary: 'List all courier partners with optional approval and online status filters' })
  async getRiders(
    @Query('approvalStatus') approvalStatus?: 'PENDING' | 'APPROVED' | 'ALL',
    @Query('isOnline') isOnlineStr?: string,
  ) {
    const isOnline = isOnlineStr !== undefined ? isOnlineStr === 'true' : undefined;
    const data = await this.adminService.getAllRiders({ approvalStatus, isOnline });
    return {
      message: `Retrieved ${data.length} delivery couriers`,
      data,
    };
  }

  @Patch('riders/:id/approval')
  @ApiOperation({ summary: 'Approve or suspend a delivery courier' })
  async setRiderApproval(
    @Param('id') riderId: string,
    @Body('isApproved') isApproved: boolean,
  ) {
    const updated = await this.adminService.setRiderApproval(riderId, isApproved);
    return {
      message: `Courier approval status set to ${isApproved ? 'APPROVED' : 'SUSPENDED'}`,
      data: updated,
    };
  }

  // 11. Automated Financial Settlement Cycle Engine
  @Post('finance/settle-cycle')
  @ApiOperation({ summary: 'Execute financial settlement cycle closing pending commission and trip ledgers' })
  async executeSettlementCycle(@Req() req: ExpressRequest & { user?: { id?: string; sub?: string } }) {
    const userId = req.user?.id || req.user?.sub;
    const result = await this.adminService.executeSettlementCycle(userId);
    return result;
  }

  @Get('finance/settlement-batches')
  @ApiOperation({ summary: 'List historical settlement batches and reconciliation logs' })
  async getSettlementBatches() {
    const batches = await this.adminService.getSettlementBatches();
    return {
      message: `Retrieved ${batches.length} settlement batches`,
      data: batches,
    };
  }

  // 12. Courier Cash Deposits Governance
  @Get('finance/cash-deposits')
  @ApiOperation({ summary: 'List courier COD cash deposits awaiting verification or historical logs' })
  @ApiResponse({ status: 200, description: 'List of cash deposits' })
  async getCashDeposits(@Query('status') status?: string) {
    const data = await this.adminService.getCashDeposits(status);
    return {
      message: `Retrieved ${data.length} cash deposit records`,
      data,
    };
  }

  @Patch('finance/cash-deposits/:id/verify')
  @ApiOperation({ summary: 'Verify and approve or reject courier COD cash deposit' })
  @ApiResponse({ status: 200, description: 'Cash deposit verified and processed' })
  async verifyCashDeposit(
    @Param('id') id: string,
    @Body() dto: VerifyCashDepositDto,
  ) {
    const result = await this.adminService.verifyCashDeposit(id, dto.action, dto.notes);
    return result;
  }

  // 13. Super Admin Force-Cancel Order
  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-cancel an order prior to dispatch with mandatory audit reason' })
  @ApiResponse({ status: 200, description: 'Order force-cancelled and refunded' })
  @ApiResponse({ status: 400, description: 'Cannot cancel dispatched or delivered order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { id?: string; sub?: string } },
    @Body() dto: AdminCancelOrderDto,
  ) {
    const adminUserId = req.user?.id || req.user?.sub || 'SUPER_ADMIN';
    const order = await this.adminService.cancelOrder(adminUserId, id, dto);
    return {
      message: 'Order force-cancelled successfully',
      data: order,
    };
  }
}

