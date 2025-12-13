import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { AppConfig } from '../config/app.config';
import { EmailService } from 'src/email/email.service';

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
  providers: [AuthService, JwtStrategy, RolesGuard, EmailService],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, RolesGuard, EmailService],
})
export class AuthModule {}
