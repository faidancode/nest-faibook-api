import type { Request } from 'express';
import type { JwtPayload } from 'src/auth/auth.schemas';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
