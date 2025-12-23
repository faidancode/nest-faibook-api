import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfig } from '../config/app.config';
import type { JwtPayload } from './auth.schemas';

function cookieExtractor(req: Request): string | null {
  if (req?.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // 2. Fallback: Parse manual dari header 'cookie' (penting untuk Proxy)
  const rawCookieHeader = req.headers.cookie;
  if (rawCookieHeader) {
    // Mencari value dari key 'accessToken' menggunakan regex
    const match = rawCookieHeader.match(/accessToken=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(appConfig: AppConfig) {
    const jwtCfg = appConfig.jwt;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1) Bearer token
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2) Cookie
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.accessSecret,
      passReqToCallback: true,
    });
  }

  private logClientSource(req: Request) {
    const ua = (req.headers['user-agent'] as string | undefined) ?? '';
    const xClient = (req.headers['x-client'] as string | undefined) ?? 'unset';
    const uaGuess = ua.toLowerCase().includes('okhttp')
      ? 'react-native (ua guess)'
      : 'web/next (ua guess)';

    console.log('Incoming auth request:', {
      clientHeader: xClient,
      uaGuess,
      ua,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    this.logClientSource(req);
    return payload;
  }
}
