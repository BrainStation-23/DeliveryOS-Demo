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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IMAGE_UPLOAD_INTERCEPTOR_OPTIONS } from '../../common/storage/image-upload.options';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { MediaService } from '../media/media.service';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { VerifyCashDepositDto } from './dto/verify-cash-deposit.dto';
import {
  AssignVendorStaffDto,
  CreateBannerDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateCouponDto,
  CreateOutletCategoryDto,
  CreateStaffUserDto,
  CreateVendorDto,
  ForceAssignRiderDto,
  GetLiveOrdersQueryDto,
  GetRidersQueryDto,
  SaveProductDto,
  SetRiderApprovalDto,
  ToggleVendorStatusDto,
  UpdateBannerDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateCouponDto,
  UpdateDeliveryFeeDto,
  UpdateOperatingHoursDto,
  UpdateRiderCashLimitDto,
  UpdateStaffAccountDto,
  UpdateVendorDto,
  UpdateVendorStaffDto,
} from './dto/admin-governance.dto';

@ApiTags('Super Admin Master Governance')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly mediaService: MediaService,
  ) {}

  // 0. Media Uploads (legacy alias — every upload is registered in the media library)
  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD_INTERCEPTOR_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image (JPEG/PNG/WebP/GIF, max 5 MB); registers a media library asset' })
  @ApiResponse({ status: 201, description: 'Registered media asset with its public URL' })
  async uploadImage(
    @UploadedFile() file?: Express.Multer.File,
    @CurrentUser() user?: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException('Multipart field "file" is required');
    }
    const data = await this.mediaService.uploadImage(file, { uploadedById: user?.id });
    return {
      message: 'Image uploaded successfully',
      data,
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
  async updateCashLimit(@Param('id') id: string, @Body() dto: UpdateRiderCashLimitDto) {
    const updated = await this.adminService.updateRiderCashLimit(id, dto.maxCashLimit);
    return {
      message: 'Rider cash safety limit updated',
      data: updated,
    };
  }

  // 3. Live Order Monitor & Force-Assign Override
  @Get('orders')
  @ApiOperation({ summary: 'Get paginated live orders queue across all lifecycle stages' })
  async getOrders(@Query() query: GetLiveOrdersQueryDto = new GetLiveOrdersQueryDto()) {
    const result = await this.adminService.getLiveOrders(query.status, query);
    return {
      message: `Retrieved ${result.items.length} of ${result.total} orders in queue`,
      data: result,
    };
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get the full detail view (info, money breakdown, lifecycle timestamps) for one order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') orderId: string) {
    const data = await this.adminService.getOrderById(orderId);
    return {
      message: `Order ${data.orderNumber} retrieved`,
      data,
    };
  }

  @Post('orders/:id/force-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin manual dispatch force-assignment override' })
  @ApiResponse({ status: 200, description: 'Rider manually assigned to order' })
  async forceAssign(@Param('id') orderId: string, @Body() dto: ForceAssignRiderDto) {
    const result = await this.adminService.forceAssignRider(orderId, dto.riderId);
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
  async createBanner(@Body() dto: CreateBannerDto) {
    const banner = await this.adminService.createBanner(dto);
    return {
      message: 'Promotional banner created successfully',
      data: banner,
    };
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: 'Update or toggle promotional banner' })
  async updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
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
  async createCoupon(@Body() dto: CreateCouponDto) {
    const coupon = await this.adminService.createCoupon(dto);
    return {
      message: `Coupon code "${coupon.code}" created successfully`,
      data: coupon,
    };
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Update or toggle coupon code' })
  async updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
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

  @Get('vendors/:id/catalog')
  @ApiOperation({ summary: 'Full catalog governance view for one outlet (categories, products, variants, add-ons)' })
  @ApiResponse({ status: 404, description: 'Vendor outlet not found' })
  async getVendorCatalog(@Param('id') vendorId: string) {
    const data = await this.adminService.getVendorCatalog(vendorId);
    return {
      message: `Retrieved catalog for ${data.vendorName}`,
      data,
    };
  }

  @Get('outlets/:id')
  @ApiOperation({ summary: 'Aggregated outlet detail: brand, outlet info, staff, operating hours, catalog' })
  @ApiResponse({ status: 404, description: 'Vendor outlet not found' })
  async getOutletDetail(@Param('id') vendorId: string) {
    const data = await this.adminService.getOutletDetail(vendorId);
    return {
      message: `Retrieved outlet detail for ${data.vendor.name}`,
      data,
    };
  }

  @Put('vendors/:id/operating-hours')
  @ApiOperation({ summary: 'Replace the outlet weekly operating schedule (7 days)' })
  async updateOperatingHours(@Param('id') vendorId: string, @Body() dto: UpdateOperatingHoursDto) {
    const data = await this.adminService.updateOutletOperatingHours(vendorId, dto.hours);
    return {
      message: 'Operating hours updated successfully',
      data,
    };
  }

  @Post('vendors/:id/categories')
  @ApiOperation({ summary: 'Create an outlet-scoped menu category' })
  async createOutletCategory(@Param('id') vendorId: string, @Body() dto: CreateOutletCategoryDto) {
    const data = await this.adminService.createOutletCategory(vendorId, dto);
    return {
      message: 'Category created successfully',
      data,
    };
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Rename, resort, or deactivate a category' })
  async updateCategory(@Param('id') categoryId: string, @Body() dto: UpdateCategoryDto) {
    const data = await this.adminService.updateCategory(categoryId, dto);
    return {
      message: 'Category updated successfully',
      data,
    };
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product with its ordered variations (first variation defines the product price)' })
  async createProduct(@Body() dto: SaveProductDto) {
    const data = await this.adminService.saveProduct(dto);
    return {
      message: 'Product created successfully',
      data,
    };
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Wholesale product save — variations create/update/delete/reorder in one transaction' })
  async updateProduct(@Param('id') productId: string, @Body() dto: SaveProductDto) {
    const data = await this.adminService.saveProduct(dto, productId);
    return {
      message: 'Product updated successfully',
      data,
    };
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Directly create new vendor outlet' })
  async createVendor(@Body() dto: CreateVendorDto) {
    const vendor = await this.adminService.createVendor(dto);
    return {
      message: 'Vendor outlet created successfully',
      data: vendor,
    };
  }

  @Patch('vendors/:id')
  @ApiOperation({ summary: 'Update vendor outlet parameters (commission, radius, prep time, contact)' })
  async updateVendor(@Param('id') vendorId: string, @Body() dto: UpdateVendorDto) {
    const updated = await this.adminService.updateVendor(vendorId, dto);
    return {
      message: 'Vendor outlet updated successfully',
      data: updated,
    };
  }

  @Patch('vendors/:id/status')
  @ApiOperation({ summary: 'Toggle vendor outlet active/suspended status' })
  async toggleVendorStatus(@Param('id') vendorId: string, @Body() dto: ToggleVendorStatusDto) {
    const updated = await this.adminService.toggleVendorStatus(vendorId, dto.isActive);
    return {
      message: `Vendor outlet ${dto.isActive ? 'activated' : 'suspended'} successfully`,
      data: updated,
    };
  }

  @Post('vendors/:id/staff')
  @ApiOperation({ summary: 'Assign staff user to vendor outlet with scope (Particular vs Brand Owner)' })
  async assignStaff(@Param('id') vendorId: string, @Body() dto: AssignVendorStaffDto) {
    const staff = await this.adminService.assignVendorStaff(vendorId, dto);
    return {
      message: 'Staff user successfully assigned to vendor outlet',
      data: staff,
    };
  }

  // 6b. Brand Governance
  @Get('brands')
  @ApiOperation({ summary: 'List vendor brands with outlet/staff counts (optional name search)' })
  async getBrands(@Query('search') search?: string) {
    const data = await this.adminService.searchBrands(search);
    return {
      message: `Retrieved ${data.length} brands`,
      data,
    };
  }

  @Post('brands')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a vendor brand umbrella' })
  async createBrand(@Body() dto: CreateBrandDto) {
    const data = await this.adminService.createBrand(dto);
    return {
      message: 'Brand created successfully',
      data,
    };
  }

  @Patch('brands/:id')
  @ApiOperation({ summary: 'Update brand name or logo URL' })
  async updateBrand(@Param('id') brandId: string, @Body() dto: UpdateBrandDto) {
    const data = await this.adminService.updateBrand(brandId, dto);
    return {
      message: 'Brand updated successfully',
      data,
    };
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a brand (blocked while outlets or staff remain assigned)' })
  @ApiResponse({ status: 409, description: 'Brand still has outlets or staff assignments' })
  async deleteBrand(@Param('id') brandId: string) {
    await this.adminService.deleteBrand(brandId);
    return {
      message: 'Brand deleted successfully',
      data: null,
    };
  }

  // 6c. Owner / Staff Account Governance
  @Get('users/search')
  @ApiOperation({ summary: 'Find platform users by phone fragment (for staff assignment)' })
  async searchUsers(@Query('phone') phone?: string) {
    const data = await this.adminService.searchUsersByPhone(phone || '');
    return {
      message: `Found ${data.length} user(s)`,
      data,
    };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a vendor owner/staff account (sign-in happens via phone OTP)' })
  @ApiResponse({ status: 409, description: 'An account with this phone already exists' })
  async createStaffUser(@Body() dto: CreateStaffUserDto) {
    const data = await this.adminService.createStaffUser(dto);
    return {
      message: 'Staff account created successfully — the owner signs in with their phone via OTP',
      data,
    };
  }

  @Get('vendor-staff')
  @ApiOperation({ summary: 'List every vendor staff assignment with outlet/brand and scope' })
  async getVendorStaff() {
    const data = await this.adminService.getAllVendorStaff();
    return {
      message: `Retrieved ${data.length} staff assignments`,
      data,
    };
  }

  @Patch('vendor-staff/:id')
  @ApiOperation({ summary: 'Update a staff assignment (scope switch, active/inactive toggle)' })
  async updateVendorStaff(@Param('id') staffId: string, @Body() dto: UpdateVendorStaffDto) {
    const data = await this.adminService.updateVendorStaffAssignment(staffId, dto);
    return {
      message: 'Staff assignment updated successfully',
      data,
    };
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Edit a staff account name or phone (duplicate phone 409)' })
  async updateStaffAccount(@Param('id') userId: string, @Body() dto: UpdateStaffAccountDto) {
    const data = await this.adminService.updateStaffAccount(userId, dto);
    return {
      message: 'Staff account updated successfully',
      data,
    };
  }

  @Delete('vendor-staff/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff assignment (last-assignment accounts demote to CUSTOMER)' })
  async removeVendorStaff(@Param('id') staffId: string) {
    const data = await this.adminService.removeVendorStaff(staffId);
    return {
      message: data.demoted
        ? 'Staff assignment removed and the account demoted to CUSTOMER'
        : 'Staff assignment removed',
      data,
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
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.adminService.createCentralCategory(dto);
    return {
      message: 'Central category created successfully',
      data: category,
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
  async updateDeliveryFee(@Body() dto: UpdateDeliveryFeeDto) {
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
  async getRiders(@Query() query: GetRidersQueryDto = new GetRidersQueryDto()) {
    const data = await this.adminService.getAllRiders({ approvalStatus: query.approvalStatus, isOnline: query.isOnlineParsed });
    return {
      message: `Retrieved ${data.length} delivery couriers`,
      data,
    };
  }

  @Patch('riders/:id/approval')
  @ApiOperation({ summary: 'Approve or suspend a delivery courier' })
  async setRiderApproval(@Param('id') riderId: string, @Body() dto: SetRiderApprovalDto) {
    const updated = await this.adminService.setRiderApproval(riderId, dto.isApproved);
    return {
      message: `Courier approval status set to ${dto.isApproved ? 'APPROVED' : 'SUSPENDED'}`,
      data: updated,
    };
  }

  // 11. Automated Financial Settlement Cycle Engine
  @Post('finance/settle-cycle')
  @ApiOperation({ summary: 'Execute financial settlement cycle closing pending commission and trip ledgers' })
  async executeSettlementCycle(@CurrentUser('id') adminUserId: string) {
    const result = await this.adminService.executeSettlementCycle(adminUserId);
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
    @CurrentUser('id') adminUserId: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    const order = await this.adminService.cancelOrder(adminUserId || 'SUPER_ADMIN', id, dto);
    return {
      message: 'Order force-cancelled successfully',
      data: order,
    };
  }
}

