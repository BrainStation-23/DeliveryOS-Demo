import { Module } from '@nestjs/common';
import { CartController, VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { OutletTypesModule } from '../outlet-types/outlet-types.module';

@Module({
  imports: [OutletTypesModule],
  controllers: [VendorController, CartController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
