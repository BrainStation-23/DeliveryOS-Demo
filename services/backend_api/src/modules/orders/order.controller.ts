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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ValidateReorderDto } from './dto/validate-reorder.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@ApiTags('Orders & Ledger')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place an order with atomic ACID guarantees and geofence verification' })
  @ApiResponse({ status: 201, description: 'Order successfully placed with ledger created' })
  @ApiResponse({ status: 400, description: 'Single-vendor violation or invalid items' })
  @ApiResponse({ status: 422, description: 'Address outside vendor coverage' })
  async checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    const result = await this.orderService.checkout(user.id, dto);
    return {
      message: 'Order placed successfully',
      data: result,
    };
  }

  @Post('validate-reorder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate stock and pricing to re-order previous items' })
  @ApiResponse({ status: 200, description: 'Re-order validation result' })
  async validateReorder(@CurrentUser() user: User, @Body() dto: ValidateReorderDto) {
    const result = await this.orderService.validateReorder(user.id, dto);
    return {
      message: 'Re-order validation completed',
      data: result,
    };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated order history for authenticated customer' })
  @ApiResponse({ status: 200, description: 'Paginated list of previous orders' })
  async getOrderHistory(@CurrentUser() user: User, @Query() pagination: PaginationQueryDto) {
    const result = await this.orderService.getCustomerOrderHistory(user.id, pagination);
    return {
      message: 'Order history retrieved successfully',
      data: result,
    };
  }

  @Get(':id/live-tracking')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get live location, ETA, and route waypoints for order tracking fallback' })
  @ApiResponse({ status: 200, description: 'Live tracking telemetry and route snapshot' })
  @ApiResponse({ status: 403, description: 'Forbidden if not customer or staff' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getLiveTracking(@Param('id') id: string, @CurrentUser() user: User) {
    const tracking = await this.orderService.getLiveTracking(id, user.id, user.role);
    return {
      message: 'Live tracking retrieved successfully',
      data: tracking,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed order tracking and items by order ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 403, description: 'Forbidden if not order owner or staff' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.orderService.getOrderById(id, user.id, user.role);
    return {
      message: 'Order details retrieved successfully',
      data: order,
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel order by customer prior to kitchen preparation (PLACED / RIDER_ASSIGNED)' })
  @ApiResponse({ status: 200, description: 'Order successfully cancelled and refunded if paid online' })
  @ApiResponse({ status: 400, description: 'Cannot cancel after kitchen preparation has started' })
  @ApiResponse({ status: 403, description: 'Forbidden if not order owner' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CancelOrderDto,
  ) {
    const order = await this.orderService.cancelCustomerOrder(user.id, id, dto);
    return {
      message: 'Order cancelled successfully',
      data: order,
    };
  }

  @Post(':id/switch-cod')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch an unpaid placed online order to Cash On Delivery' })
  @ApiResponse({ status: 200, description: 'Order payment method switched to Cash on Delivery' })
  @ApiResponse({ status: 400, description: 'Order not in PLACED status or already paid' })
  @ApiResponse({ status: 403, description: 'Forbidden if not order owner' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async switchPaymentToCOD(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.orderService.switchToCOD(user.id, id);
    return {
      message: 'Order payment method successfully switched to Cash on Delivery',
      data: order,
    };
  }
}

