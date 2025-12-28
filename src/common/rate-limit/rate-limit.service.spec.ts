import { RateLimitService } from './rate-limit.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    expect(() => {
      service.check('1.1.1.1', 'global', 3, 10000);
      service.check('1.1.1.1', 'global', 3, 10000);
      service.check('1.1.1.1', 'global', 3, 10000);
    }).not.toThrow();
  });

  it('should throw 429 when limit is exceeded', () => {
    service.check('1.1.1.1', 'global', 2, 10000);
    service.check('1.1.1.1', 'global', 2, 10000);

    try {
      service.check('1.1.1.1', 'global', 2, 10000);
      fail('Expected rate limit exception');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const response = err.getResponse() as any;
      expect(response.code).toBe('RATE_LIMITED');
      expect(response.retryAfter).toBeGreaterThan(0);
    }
  });

  it('should reset counter after TTL expires', () => {
    service.check('1.1.1.1', 'global', 1, 10000);

    // advance time beyond TTL
    jest.advanceTimersByTime(10001);

    expect(() => {
      service.check('1.1.1.1', 'global', 1, 10000);
    }).not.toThrow();
  });

  it('should isolate buckets by identifier (email)', () => {
    service.check(
      '1.1.1.1',
      'password-reset',
      1,
      10000,
      'a@test.com',
    );

    // different email → should pass
    expect(() => {
      service.check(
        '1.1.1.1',
        'password-reset',
        1,
        10000,
        'b@test.com',
      );
    }).not.toThrow();
  });

  it('should isolate buckets by IP', () => {
    service.check('1.1.1.1', 'global', 1, 10000);

    // different IP → should pass
    expect(() => {
      service.check('2.2.2.2', 'global', 1, 10000);
    }).not.toThrow();
  });

  it('should throw 429 independently per identifier', () => {
    service.check(
      '1.1.1.1',
      'password-reset',
      1,
      10000,
      'a@test.com',
    );

    try {
      service.check(
        '1.1.1.1',
        'password-reset',
        1,
        10000,
        'a@test.com',
      );
      fail('Expected rate limit exception');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
