import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  GetAnalyticsOverviewQueryDto,
  GetOrdersSummaryQueryDto,
} from './dto/admin-insights.dto';

@ApiTags('Super Admin Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Date-ranged dashboard analytics: KPI cards with trend deltas, status mix, timeseries, top outlets and riders' })
  @ApiResponse({ status: 200, description: 'Aggregated analytics for the requested window' })
  @ApiResponse({ status: 400, description: 'Invalid or over-long window' })
  async getOverview(@Query() query: GetAnalyticsOverviewQueryDto = new GetAnalyticsOverviewQueryDto()) {
    const data = await this.analyticsService.getAnalyticsOverview(query);
    return {
      message: `Analytics for ${data.window.from} → ${data.window.to}`,
      data,
    };
  }

  @Get('orders-summary')
  @ApiOperation({ summary: 'Per-status order counts honoring the Order History date/search filters' })
  @ApiResponse({ status: 200, description: 'Status counts and grand total' })
  async getOrdersSummary(@Query() query: GetOrdersSummaryQueryDto = new GetOrdersSummaryQueryDto()) {
    const data = await this.analyticsService.getOrdersSummary(query);
    return {
      message: `Retrieved status counts for ${data.total} orders`,
      data,
    };
  }
}
