// src/common/rate-limit/rate-limit.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface BucketState {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, BucketState>();

  check(ip: string, key: string, limit: number, ttlMs: number) {
    const now = Date.now();
    const bucketKey = `${ip}|${key}`;
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
