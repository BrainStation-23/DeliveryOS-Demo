import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('Notifications')
@Controller('auth/device-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or update FCM device push notification token' })
  @ApiResponse({ status: 200, description: 'Device token registered successfully' })
  async registerDeviceToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const result = await this.notificationsService.registerDeviceToken(user.id, dto);
    return {
      message: 'Device token registered successfully',
      data: result,
    };
  }
}
