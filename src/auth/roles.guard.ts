import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from './auth.schemas';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Jika rute tidak diproteksi role, izinkan
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Cek apakah user ada (hasil dari JwtAuthGuard)
    if (!user || !user.role) {
      throw new ForbiddenException('No role found in token');
    }

    // Cek apakah role user ada di dalam array requiredRoles
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      // Baris inilah yang menghalangi GUESTADMIN jika tidak disertakan di @Roles
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
