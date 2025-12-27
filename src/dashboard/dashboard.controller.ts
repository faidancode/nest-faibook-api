import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';
import {
  LowStockQuerySchema,
  RangeQuerySchema,
  RecentOrdersQuerySchema,
  RecentReviewsQuerySchema,
  SummaryQuerySchema,
  TopBooksQuerySchema,
} from './dashboard.schemas';
import { AdminAuthWithDemo } from 'src/common/decorators/admin-auth-with-demo.decorator';

@Controller('v1/admin/dashboard')
@AdminAuthWithDemo()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary(@Query() query: unknown) {
    const parsed = SummaryQuerySchema.parse(query);
    return this.dashboardService.getSummary(parsed);
  }

  @Get('sales-trend')
  async salesTrend(@Query() query: unknown) {
    const parsed = RangeQuerySchema.parse(query);
    return this.dashboardService.getSalesTrend(parsed);
  }

  @Get('top-books')
  async topBooks(@Query() query: unknown) {
    const parsed = TopBooksQuerySchema.parse(query);
    return this.dashboardService.getTopBooks(parsed);
  }

  @Get('recent-orders')
  async recentOrders(@Query() query: unknown) {
    const parsed = RecentOrdersQuerySchema.parse(query);
    return this.dashboardService.getRecentOrders(parsed);
  }

  @Get('low-stock')
  async lowStock(@Query() query: unknown) {
    const parsed = LowStockQuerySchema.parse(query);
    return this.dashboardService.getLowStock(parsed);
  }

  @Get('recent-reviews')
  async recentReviews(@Query() query: unknown) {
    const parsed = RecentReviewsQuerySchema.parse(query);
    return this.dashboardService.getRecentReviews(parsed);
  }
}
