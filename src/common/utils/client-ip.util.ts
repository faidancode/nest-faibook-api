import type { Request } from 'express';

export function getClientIp(req: Request): string {
  return (
    (req.headers['cf-connecting-ip'] as string | undefined) ||
    (req.headers['x-real-ip'] as string | undefined) ||
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ||
    req.socket.remoteAddress ||
    '0.0.0.0'
  );
}
