import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { AppConfig } from '../config/app.config';
import { EmailService } from 'src/email/email.service';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => {
        const jwt = appConfig.jwt;
        return {
          secret: jwt.accessSecret,
          signOptions: { expiresIn: jwt.accessExpiresIn },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    EmailService,
    RateLimitService,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    EmailService,
    RateLimitService,
  ],
})
export class AuthModule {}
