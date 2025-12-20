import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { ListCustomersQuerySchema } from './customers.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN')
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
