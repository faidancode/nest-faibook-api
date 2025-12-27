import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { DemoModeGuard } from 'src/auth/demo-mode.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/auth/roles.guard';

export function AdminAuthWithDemo() {
  return applyDecorators(
    SetMetadata('roles', ['SUPERADMIN', 'ADMIN', 'GUESTADMIN']),
    UseGuards(JwtAuthGuard, RolesGuard, DemoModeGuard),
  );
}
