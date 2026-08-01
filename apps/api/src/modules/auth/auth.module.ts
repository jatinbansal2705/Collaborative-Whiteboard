import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './auth-token.service';
import { GoogleOAuthCallbackGuard } from './guards/google-oauth-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        signOptions: {
          issuer: configService.get<string>('jwt.issuer'),
          audience: configService.get<string>('jwt.audience'),
        },
      }),
      inject: [ConfigService],
    }),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    SessionRepository,
    PasswordResetTokenRepository,
    JwtAuthGuard,
    RolesGuard,
    SessionGuard,
    GoogleOAuthGuard,
    GoogleOAuthCallbackGuard,
    {
      provide: TokenService,
      inject: [JwtService, ConfigService],
      useFactory: (
        jwtService: JwtService,
        configService: ConfigService,
      ): TokenService =>
        new TokenService(jwtService, {
          accessSecret: configService.get<string>('jwt.accessSecret') ?? '',
          accessExpiresIn: (configService.get<string>('jwt.accessExpiresIn') ??
            '15m') as StringValue,
          refreshSecret: configService.get<string>('jwt.refreshSecret') ?? '',
          refreshExpiresIn: (configService.get<string>(
            'jwt.refreshExpiresIn',
          ) ?? '30d') as StringValue,
          emailSecret: configService.get<string>('jwt.emailSecret') ?? '',
          emailExpiresIn: (configService.get<string>('jwt.emailExpiresIn') ??
            '24h') as StringValue,
          passwordResetSecret:
            configService.get<string>('jwt.passwordResetSecret') ?? '',
          passwordResetExpiresIn: (configService.get<string>(
            'jwt.passwordResetExpiresIn',
          ) ?? '1h') as StringValue,
          oauthHandoffSecret:
            configService.get<string>('jwt.oauthHandoffSecret') ?? '',
          oauthHandoffExpiresIn: (configService.get<string>(
            'jwt.oauthHandoffExpiresIn',
          ) ?? '5m') as StringValue,
          issuer: configService.get<string>('jwt.issuer') ?? '',
          audience: configService.get<string>('jwt.audience') ?? '',
        }),
    },
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    SessionGuard,
    TokenService,
    UserRepository,
  ],
})
export class AuthModule {}
