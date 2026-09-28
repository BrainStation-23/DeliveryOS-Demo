import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Online Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate online payment session for checkout order' })
  async initiatePayment(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(userId, dto);
  }

  @Post('webhook/:gateway')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Instant Payment Notification (IPN) webhook callback from payment provider' })
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.handleWebhook(gateway, payload, headers);
  }

  @Get('status/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current payment status for a transaction' })
  async getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentsService.getPaymentStatus(transactionId);
  }

  @Get('callback/:gateway')
  @ApiOperation({ summary: 'Browser redirect return URL after payment attempt' })
  async handleCallback(
    @Param('gateway') gateway: string,
    @Query('status') status?: string,
    @Query('transactionId') transactionId?: string,
  ) {
    return {
      message: 'Payment return processed',
      gateway,
      status: status || 'UNKNOWN',
      transactionId: transactionId || null,
    };
  }
}
