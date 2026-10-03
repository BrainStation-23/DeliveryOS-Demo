import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminCustomersService } from './admin-customers.service';
import { GetCustomersQueryDto, UpdateCustomerStatusDto } from './dto/admin-insights.dto';

@ApiTags('Super Admin Customer Governance')
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated customer directory with order counts and lifetime spend' })
  @ApiResponse({ status: 200, description: 'Paginated customer rows' })
  async getCustomers(@Query() query: GetCustomersQueryDto = new GetCustomersQueryDto()) {
    const result = await this.customersService.getCustomersPage(query);
    return {
      message: `Retrieved ${result.items.length} of ${result.total} customers`,
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Customer detail: profile, addresses, order metrics, and recent orders' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomer(@Param('id') customerId: string) {
    const data = await this.customersService.getCustomerDetail(customerId);
    return {
      message: `Retrieved profile for ${data.customer.fullName}`,
      data,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update customer status (ACTIVE or SUSPENDED)' })
  @ApiResponse({ status: 200, description: 'Updated customer status' })
  async updateCustomerStatus(
    @Param('id') customerId: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    const data = await this.customersService.updateCustomerStatus(customerId, dto.status, dto.reason);
    return {
      message: `Customer account status updated to ${dto.status}`,
      data,
    };
  }
}

