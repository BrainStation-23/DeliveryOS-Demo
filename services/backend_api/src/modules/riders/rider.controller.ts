import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';
import { RiderService } from './rider.service';
import { ToggleDutyDto } from './dto/toggle-duty.dto';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { DepositCashDto } from './dto/deposit-cash.dto';

@ApiTags('Rider Operations')
@Controller('rider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
@ApiBearerAuth()
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current rider duty status, wallet, and profile' })
  @ApiResponse({ status: 200, description: 'Rider profile data' })
  async getProfile(@CurrentUser() user: User) {
    const rider = await this.riderService.getRiderProfile(user.id);
    return {
      message: 'Rider profile retrieved',
      data: rider,
    };
  }

  @Get('active-trip')
  @ApiOperation({ summary: 'Get current in-flight active delivery trip for rehydration' })
  @ApiResponse({ status: 200, description: 'Active delivery trip if present, otherwise null' })
  async getActiveTrip(@CurrentUser() user: User) {
    const activeTrip = await this.riderService.getActiveTrip(user.id);
    return {
      message: activeTrip ? 'Active trip retrieved' : 'No active trip in progress',
      data: activeTrip,
    };
  }

  @Patch('duty')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle rider online/offline duty status and sync telemetry' })
  @ApiResponse({ status: 200, description: 'Duty status updated' })
  async toggleDuty(
    @CurrentUser() user: User,
    @Body() dto: ToggleDutyDto,
  ) {
    const rider = await this.riderService.toggleDuty(user.id, dto);
    return {
      message: `Rider is now ${rider.isOnline ? 'ONLINE' : 'OFFLINE'}`,
      data: rider,
    };
  }

  @Post('orders/:id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atomically claim broadcasted order protected by Redis distributed lock' })
  @ApiResponse({ status: 200, description: 'Order successfully claimed by rider' })
  @ApiResponse({ status: 409, description: 'Conflict if order already claimed or lock held' })
  async claimOrder(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
  ) {
    const order = await this.riderService.claimOrder(user.id, orderId);
    return {
      message: 'Order claimed successfully',
      data: order,
    };
  }

  @Patch('orders/:id/pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm order pickup from store counter' })
  @ApiResponse({ status: 200, description: 'Order marked as DISPATCHED' })
  async pickupOrder(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
  ) {
    const order = await this.riderService.pickupOrder(user.id, orderId);
    return {
      message: 'Order picked up and dispatched for delivery',
      data: order,
    };
  }

  @Patch('orders/:id/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm delivery to customer and record COD cash collected' })
  @ApiResponse({ status: 200, description: 'Order delivered and trip ledger created' })
  async deliverOrder(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
    @Body() dto: DeliverOrderDto,
  ) {
    const result = await this.riderService.deliverOrder(user.id, orderId, dto);
    return {
      message: 'Order delivered successfully',
      data: result,
    };
  }

  @Post('cash/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit collected COD cash into platform custody' })
  @ApiResponse({ status: 200, description: 'Cash deposit request submitted for admin approval' })
  async depositCash(
    @CurrentUser() user: User,
    @Body() dto: DepositCashDto,
  ) {
    const result = await this.riderService.depositCash(user.id, dto);
    return {
      message: 'Cash deposit request submitted successfully',
      data: result,
    };
  }

  @Get('cash/deposits')
  @ApiOperation({ summary: 'Get history of cash deposits submitted by current rider' })
  @ApiResponse({ status: 200, description: 'Rider cash deposit history' })
  async getCashDeposits(@CurrentUser() user: User) {
    const deposits = await this.riderService.getCashDeposits(user.id);
    return {
      message: 'Cash deposits retrieved successfully',
      data: deposits,
    };
  }

  @Get('trips')
  @ApiOperation({ summary: 'Get history of completed delivery trips and earnings for current rider' })
  @ApiResponse({ status: 200, description: 'Rider trip history and earnings' })
  async getTrips(@CurrentUser() user: User) {
    const trips = await this.riderService.getRiderTrips(user.id);
    return {
      message: 'Rider trips retrieved successfully',
      data: trips,
    };
  }

  @Get('earnings/summary')
  @ApiOperation({ summary: 'Server-truth earnings for today and the trailing 7 region-local days' })
  @ApiResponse({ status: 200, description: 'Rider earnings summary (today + week windows)' })
  async getEarningsSummary(@CurrentUser() user: User) {
    const summary = await this.riderService.getEarningsSummary(user.id);
    return {
      message: 'Rider earnings summary retrieved',
      data: summary,
    };
  }

  @Post('orders/:id/report-issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report delivery issue or unreachable customer at doorstep' })
  @ApiResponse({ status: 200, description: 'Issue reported and courier released' })
  async reportIssue(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
    @Body('reason') reason?: string,
  ) {
    const result = await this.riderService.reportDeliveryIssue(
      user.id,
      orderId,
      reason || 'Customer unreachable at delivery address',
    );
    return result;
  }
}

