import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import {
  CheckoutOrderSchema,
  CustomerUpdateStatusSchema,
  UserListOrdersQuerySchema,
} from './schemas/orders.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.schemas';

@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private assertUserAccess(user: JwtPayload, requestedUserId: string) {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      console.log(user.role);
      return;
    }

    if (user.sub !== requestedUserId) {
      throw new ForbiddenException('Cannot access other user orders');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getByUser(
    @Param('userId') userId: string,
    @Req() req: Request,
    @Query() query: unknown,
  ) {
    const parsedQuery = UserListOrdersQuerySchema.parse(query);
    const currentUser = req.user as JwtPayload;
    this.assertUserAccess(currentUser, userId);
    return this.ordersService.getOrdersByUserId(userId, parsedQuery.status, {
      page: parsedQuery.page,
      pageSize: parsedQuery.pageSize,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDetails(@Param('id') id: string, @Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    const scopedUserId = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' ? undefined : currentUser.sub;
    return this.ordersService.getOrderDetails(id, scopedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/continue-payment')
  async continuePayment(@Param('id') id: string, @Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    const scopedUserId = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' ? undefined : currentUser.sub;
    return this.ordersService.createMidtransTransactionToken(id, scopedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = CheckoutOrderSchema.parse(body);
    const currentUser = req.user as JwtPayload;
    this.assertUserAccess(currentUser, parsed.userId);
    return this.ordersService.checkout(parsed, {
      idempotencyKey: idempotencyKey ?? undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status/customer')
  async updateCustomerStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = CustomerUpdateStatusSchema.parse(body ?? {});
    const currentUser = req.user as JwtPayload;
    console.log('Req:', req);
    console.log('Current User:', currentUser);
    return this.ordersService.updateCustomerStatus(
      id,
      currentUser.sub,
      parsed,
    );
  }
}
