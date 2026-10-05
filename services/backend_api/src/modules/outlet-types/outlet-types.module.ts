import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OutletTypesController } from './outlet-types.controller';
import { OutletTypesService } from './outlet-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [OutletTypesController],
  providers: [OutletTypesService],
  exports: [OutletTypesService],
})
export class OutletTypesModule {}
