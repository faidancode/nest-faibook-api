// src/config/app.config.ts
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import type { Env } from './env.schema';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: StringValue;
  refreshSecret: string;
  refreshExpiresIn: StringValue;
}

export interface RateLimitConfig {
  globalTtl: number;
  globalLimit: number;
  loginTtl: number;
  loginLimit: number;
}

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
}

export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port() {
    return this.config.get('PORT', { infer: true });
  }

  get db(): DbConfig {
    return {
      host: this.config.get('DB_HOST', { infer: true }),
      port: this.config.get('DB_PORT', { infer: true }),
      user: this.config.get('DB_USER', { infer: true }),
      password: this.config.get('DB_PASSWORD', { infer: true }),
      database: this.config.get('DB_NAME', { infer: true }),
    };
  }

  get jwt(): JwtConfig {
    return {
      accessSecret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      accessExpiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', {
        infer: true,
      }),
      refreshSecret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      refreshExpiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', {
        infer: true,
      }),
    };
  }

  get rateLimit(): RateLimitConfig {
    return {
      globalTtl: this.config.get('RATE_GLOBAL_TTL', { infer: true }),
      globalLimit: this.config.get('RATE_GLOBAL_LIMIT', { infer: true }),
      loginTtl: this.config.get('RATE_LOGIN_TTL', { infer: true }),
      loginLimit: this.config.get('RATE_LOGIN_LIMIT', { infer: true }),
    };
  }

  get cors(): CorsConfig {
    const raw = this.config.get('CORS_ORIGINS', { infer: true });
    const credentials =
      this.config.get('CORS_CREDENTIALS', { infer: true }) ?? false;

    const origins =
      raw === '*'
        ? ['*']
        : raw
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);

    return { origins, credentials };
  }

  get enableSwagger(): boolean {
    return this.config.get('ENABLE_SWAGGER', { infer: true }) ?? false;
  }

  get requestIdHeader(): string {
    return this.config.get('REQUEST_ID_HEADER', { infer: true });
  }
}
