import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './orders.admin.controller';
import { OrdersMidtransController } from './orders.midtrans.controller';
import { OrdersService } from './orders.service';
import { MidtransModule } from '../midtrans/midtrans.module';

@Module({
  imports: [MidtransModule],
  controllers: [
    OrdersController,
    OrdersAdminController,
    OrdersMidtransController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
