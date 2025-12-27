import { SetMetadata } from '@nestjs/common';
import { SKIP_RATE_LIMIT } from '../constants/rate-limit-constants';

export const SkipRateLimit = () =>
  SetMetadata(SKIP_RATE_LIMIT, true);
