import { Controller, Get, Param, Query } from '@nestjs/common';
import { AdminAuthWithDemo } from 'src/common/decorators/admin-auth-with-demo.decorator';
import { ListCustomersQuerySchema } from './customers.schemas';
import { CustomersService } from './customers.service';

@AdminAuthWithDemo()
@Controller('v1/admin/customers')
export class CustomersController {  
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = ListCustomersQuerySchema.parse(query);
    return this.customersService.findAll(parsed);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.customersService.getCustomerWithOrders(id);
  }
}
