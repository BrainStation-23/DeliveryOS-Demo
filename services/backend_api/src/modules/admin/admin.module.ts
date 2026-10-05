import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminFleetService } from './admin-fleet.service';
import { AdminFinanceService } from './admin-finance.service';
import { OrderModule } from '../orders/order.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [OrderModule, PromotionsModule, NotificationsModule],
  controllers: [AdminController, AdminAnalyticsController, AdminCustomersController],
  providers: [AdminService, AdminAnalyticsService, AdminCustomersService, AdminFleetService, AdminFinanceService],
  exports: [AdminService],
})
export class AdminModule {}
