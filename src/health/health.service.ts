import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DrizzleDb } from '../infra/drizzle/client';

@Injectable()
export class HealthService {
  constructor(@Inject('DRIZZLE') private readonly db: DrizzleDb) {}

  async check() {
    const started = Date.now();
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: {
          status: 'up',
          latencyMs: Date.now() - started,
        },
      };
    } catch {
      throw new ServiceUnavailableException('Database health check failed');
    }
  }
}
