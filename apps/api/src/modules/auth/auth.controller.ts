import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  AUTH_RATE_LIMIT,
  AUTH_RATE_LIMIT_TTL_MS,
  DEVICE_MAX_LENGTH,
  FORGOT_RATE_LIMIT,
  FORGOT_RATE_LIMIT_TTL_MS,
  RESEND_RATE_LIMIT,
  RESEND_RATE_LIMIT_TTL_MS,
} from './auth.constants';
import { invalidOauthState } from './auth.errors';
import { AuthService, type RequestContext } from './auth.service';
import { GoogleOAuthCallbackGuard } from './guards/google-oauth-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { SessionGuard } from './guards/session.guard';
import type { AuthResult, RefreshResult } from './dto/auth-response.dto';
import { toUserResponse, UserResponse } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { LoginDto } from './dto/login.dto';
import type { MessageResult } from './dto/message-result.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { readOAuthStateCookie } from './google/oauth-state-cookie';
import type { GoogleOAuthProfile } from './google/google-oauth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({
    default: { limit: AUTH_RATE_LIMIT, ttl: AUTH_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Register a new account' })
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.authService.register(dto, this.toRequestContext(req, ip));
  }

  @Public()
  @Post('login')
  @Throttle({
    default: { limit: AUTH_RATE_LIMIT, ttl: AUTH_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Authenticate and obtain tokens' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.authService.login(dto, this.toRequestContext(req, ip));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<RefreshResult> {
    return this.authService.refresh(
      dto.refreshToken,
      this.toRequestContext(req, ip),
    );
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current session' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user);
  }

  @UseGuards(SessionGuard)
  @Get('me')
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current user profile' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    const profile = await this.authService.me(user);
    return toUserResponse(profile);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email address' })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResult> {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({
    default: { limit: RESEND_RATE_LIMIT, ttl: RESEND_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Resend the email verification link' })
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<MessageResult> {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({
    default: { limit: FORGOT_RATE_LIMIT, ttl: FORGOT_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Request a password reset link' })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResult> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResult> {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth authorization' })
  googleAuth(): void {
    // Redirect to Google is handled by the guard/strategy.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthCallbackGuard)
  @ApiOperation({ summary: 'Handle the Google OAuth callback' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ip: string,
  ): Promise<void> {
    const state = typeof req.query?.state === 'string' ? req.query.state : '';
    if (state === '' || state !== readOAuthStateCookie(req)) {
      throw invalidOauthState();
    }

    const profile = req.user as GoogleOAuthProfile;
    const code = await this.authService.googleOAuthCallback(
      profile,
      this.toRequestContext(req, ip),
    );

    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ??
      'http://localhost:3001';
    res.redirect(
      `${frontendUrl}/auth/oauth/complete?code=${encodeURIComponent(code)}`,
    );
  }

  @Public()
  @Post('google/exchange')
  @ApiOperation({ summary: 'Exchange a Google OAuth handoff code for tokens' })
  exchangeGoogle(
    @Body() dto: GoogleExchangeDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.authService.exchangeOAuthHandoff(
      dto.code,
      this.toRequestContext(req, ip),
    );
  }

  private toRequestContext(req: Request, ip: string): RequestContext {
    const device = req.get('user-agent');
    return {
      ip: ip === '::1' ? '127.0.0.1' : ip,
      device:
        device !== undefined && device.length > DEVICE_MAX_LENGTH
          ? device.slice(0, DEVICE_MAX_LENGTH)
          : device,
    };
  }
}
