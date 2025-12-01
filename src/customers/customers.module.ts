import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { OrdersModule } from '../orders/orders.module';
import { CustomerProfileController } from './customer-profile.controller';

@Module({
  imports: [OrdersModule],
  controllers: [CustomersController, CustomerProfileController],
  providers: [CustomersService],
})
export class CustomersModule {}
