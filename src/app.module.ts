// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import type { Env } from './config/env.schema';
import { AppConfig } from './config/app.config';
import { DrizzleModule } from './infra/drizzle/drizzle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DrizzleModule, // pakai env DB
  ],
  providers: [
    {
      provide: AppConfig,
      useFactory: (configService: ConfigService<Env, true>) =>
        new AppConfig(configService),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
