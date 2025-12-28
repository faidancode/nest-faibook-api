// src/common/rate-limit/rate-limit.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface BucketState {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, BucketState>();

   /**
   * @param ip        Client IP address
   * @param scope     Logical scope (e.g. global, password-reset)
   * @param limit     Max requests
   * @param ttlMs     Window duration in milliseconds
   * @param identifier Optional identifier (email, userId, etc)
   */
  check(
    ip: string,
    scope: string,
    limit: number,
    ttlMs: number,
    identifier?: string,
  ) {
    const now = Date.now();
    // 👉 Key composition strategy
    // global              => global:1.2.3.4
    // password-reset      => password-reset:1.2.3.4
    // password-reset+email=> password-reset:1.2.3.4:test@mail.com
    const bucketKey = identifier
      ? `${scope}:${ip}:${identifier}`
      : `${scope}:${ip}`;
    const existing = this.buckets.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + ttlMs,
      });
      return;
    }

    if (existing.count >= limit) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);

      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    existing.count += 1;
    this.buckets.set(bucketKey, existing);
  }
}
