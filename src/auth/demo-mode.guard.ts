import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (user?.role === 'GUESTADMIN' && mutationMethods.includes(req.method)) {
      throw new ForbiddenException({
        code: 'DEMO_MODE_RESTRICTION',
        message:
          'Write actions are disabled to preserve data integrity. Feel free to explore all read-only features.',
      });
    }

    return true;
  }
}
