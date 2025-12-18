import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  AdminListOrdersQuerySchema,
  AdminUpdateStatusSchema,
  UpdatePaymentStatusSchema,
} from './schemas/orders.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN','ADMIN')
export class OrdersAdminController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = AdminListOrdersQuerySchema.parse(query);
    return this.ordersService.getAdminOrdersList(parsed);
  }

  @Get('stats')
  async stats() {
    return this.ordersService.getAdminOrdersStats();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.getOrderDetails(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const parsed = AdminUpdateStatusSchema.parse(body);
    return this.ordersService.updateAdminStatus(id, parsed);
  }

  @Patch(':id/payment-status')
  async updatePaymentStatus(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdatePaymentStatusSchema.parse(body);
    return this.ordersService.updatePaymentStatus(id, parsed);
  }

  @Patch(':id/delivered')
  async markDelivered(@Param('id') id: string) {
    return this.ordersService.markShippedOrderAsDelivered(id);
  }
}
