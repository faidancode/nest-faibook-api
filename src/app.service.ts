import { Injectable } from '@nestjs/common';
import { destroyDrizzleClient } from './infra/drizzle/client';

@Injectable()
export class AppService {
  async onModuleDestroy() {
    console.log('Gracefully shutting down...');
    await destroyDrizzleClient();
  }
}
