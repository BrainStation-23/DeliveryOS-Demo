import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrderFlowService } from './order-flow.service';
import { UpdateDispatchConfigDto } from './dto/update-dispatch-config.dto';

@ApiTags('Admin Dispatch Governance')
@Controller('admin/settings/dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class OrderFlowController {
  constructor(private readonly orderFlowService: OrderFlowService) {}

  @Get()
  @ApiOperation({ summary: 'Get dispatch timing configuration (rider search timeout, stale-order TTL)' })
  @ApiResponse({ status: 200, description: 'Active dispatch timing settings' })
  async getDispatchConfig() {
    const config = await this.orderFlowService.getDispatchConfig();
    return {
      message: 'Dispatch timing configuration retrieved',
      data: config,
    };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update dispatch timing (fulfillment sequence itself is configured per outlet)' })
  @ApiResponse({ status: 200, description: 'Dispatch timing updated successfully' })
  async setDispatchConfig(@Body() dto: UpdateDispatchConfigDto) {
    const updated = await this.orderFlowService.setDispatchConfig(dto);
    return {
      message: 'Dispatch timing updated',
      data: updated,
    };
  }
}
