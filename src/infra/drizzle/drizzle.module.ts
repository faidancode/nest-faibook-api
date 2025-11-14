// src/infra/drizzle/drizzle.module.ts
import { Global, Module } from '@nestjs/common';
import { createDrizzleClient } from './client';
import { AppConfig } from '../../config/app.config';

@Global()
@Module({
  providers: [
    {
      provide: 'DRIZZLE',
      useFactory: async (appConfig: AppConfig) => {
        const dbConfig = appConfig.db;
        const db = await createDrizzleClient(dbConfig);
        return db;
      },
      inject: [AppConfig],
    },
  ],
  exports: ['DRIZZLE'],
})
export class DrizzleModule {}
