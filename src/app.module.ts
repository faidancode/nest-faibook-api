// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { DrizzleModule } from './infra/drizzle/drizzle.module';
import { APP_GUARD } from '@nestjs/core';
import { GlobalRateLimitGuard } from './common/rate-limit/global-rate-limit.guard';
import { RateLimitService } from './common/rate-limit/rate-limit.service';
import { HealthModule } from './health/health.module';
import { CategoriesModule } from './categories/categories.module';
import { AppConfigModule } from './config/app-config.module';
import { RequestIdInterceptor } from './common/http/request-id.interceptor';
import { LoggingInterceptor } from './common/http/logging.interceptor';
import { BooksModule } from './books/books.module';
import { AuthModule } from './auth/auth.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { AddressesModule } from './addresses/addresses.module';
import { CartModule } from './carts/carts.module';
import { OrdersModule } from './orders/orders.module';
import { MidtransModule } from './midtrans/midtrans.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthorsModule } from './authors/authors.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AdminModule } from './admins/admins.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    AppConfigModule,
    DrizzleModule, // pakai env DB
    AuthModule,
    HealthModule,
    CategoriesModule,
    AuthorsModule,
    BooksModule,
    WishlistsModule,
    AddressesModule,
    CartModule,
    OrdersModule,
    MidtransModule,
    CustomersModule,
    DashboardModule,
    CloudinaryModule,
    AdminModule,
  ],
  providers: [
    RateLimitService,
    RequestIdInterceptor,
    LoggingInterceptor,
    // Global guard: 100 req / 15m per IP
    {
      provide: APP_GUARD,
      useClass: GlobalRateLimitGuard,
    },
  ],
})
export class AppModule {}
