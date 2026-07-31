import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './auth-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    SessionRepository,
    JwtAuthGuard,
    RolesGuard,
    SessionGuard,
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
          issuer: configService.get<string>('jwt.issuer') ?? '',
          audience: configService.get<string>('jwt.audience') ?? '',
        }),
    },
  ],
  exports: [JwtAuthGuard, RolesGuard, SessionGuard, TokenService],
})
export class AuthModule {}
