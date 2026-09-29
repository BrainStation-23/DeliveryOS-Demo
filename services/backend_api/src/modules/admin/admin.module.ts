import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OrderModule } from '../orders/order.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [OrderModule, PromotionsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
