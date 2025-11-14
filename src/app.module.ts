// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import type { Env } from './config/env.schema';
import { AppConfig } from './config/app.config';
import { DrizzleModule } from './infra/drizzle/drizzle.module';
import { APP_GUARD } from '@nestjs/core';
import { GlobalRateLimitGuard } from './common/rate-limit/global-rate-limit.guard';
import { RateLimitService } from './common/rate-limit/rate-limit.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DrizzleModule, // pakai env DB
    HealthModule,
  ],
  providers: [
    {
      provide: AppConfig,
      useFactory: (configService: ConfigService<Env, true>) =>
        new AppConfig(configService),
      inject: [ConfigService],
    },
    RateLimitService,
    // Global guard: 100 req / 15m per IP
    {
      provide: APP_GUARD,
      useClass: GlobalRateLimitGuard,
    },
  ],
})
export class AppModule {}
