import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
  type HttpException,
} from '@nestjs/common';

export const AUTH_ERROR_CODES = {
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_EMAIL_VERIFICATION_TOKEN: 'INVALID_EMAIL_VERIFICATION_TOKEN',
  EMAIL_VERIFICATION_TOKEN_EXPIRED: 'EMAIL_VERIFICATION_TOKEN_EXPIRED',
  INVALID_PASSWORD_RESET_TOKEN: 'INVALID_PASSWORD_RESET_TOKEN',
  PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',
  PASSWORD_RESET_TOKEN_USED: 'PASSWORD_RESET_TOKEN_USED',
  INVALID_OAUTH_HANDOFF_CODE: 'INVALID_OAUTH_HANDOFF_CODE',
  OAUTH_HANDOFF_CODE_EXPIRED: 'OAUTH_HANDOFF_CODE_EXPIRED',
  GOOGLE_OAUTH_NOT_CONFIGURED: 'GOOGLE_OAUTH_NOT_CONFIGURED',
  GOOGLE_EMAIL_NOT_VERIFIED: 'GOOGLE_EMAIL_NOT_VERIFIED',
  GOOGLE_ACCOUNT_ALREADY_LINKED: 'GOOGLE_ACCOUNT_ALREADY_LINKED',
  INVALID_OAUTH_STATE: 'INVALID_OAUTH_STATE',
} as const;

export type AuthException = HttpException;

export const emailAlreadyRegistered = (): ConflictException =>
  new ConflictException({
    code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    message: 'Email is already registered',
  });

export const invalidCredentials = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    message: 'Invalid email or password',
  });

export const emailNotVerified = (): ForbiddenException =>
  new ForbiddenException({
    code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
    message: 'Email is not verified',
  });

export const accountDisabled = (): ForbiddenException =>
  new ForbiddenException({
    code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
    message: 'Account is disabled',
  });

export const invalidRefreshToken = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
    message: 'Invalid refresh token',
  });

export const refreshTokenExpired = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED,
    message: 'Refresh token has expired',
  });

export const tokenReuseDetected = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.TOKEN_REUSE_DETECTED,
    message: 'Refresh token reuse detected',
  });

export const unauthorized = (message = 'Unauthorized'): UnauthorizedException =>
  new UnauthorizedException({ code: AUTH_ERROR_CODES.UNAUTHORIZED, message });

export const invalidAccessToken = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
    message: 'Invalid access token',
  });

export const accessTokenExpiredError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.ACCESS_TOKEN_EXPIRED,
    message: 'Access token has expired',
  });

export const invalidRefreshTokenError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
    message: 'Invalid refresh token',
  });

export const refreshTokenExpiredError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED,
    message: 'Refresh token has expired',
  });

export const emailAlreadyVerified = (): ConflictException =>
  new ConflictException({
    code: AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED,
    message: 'Email is already verified',
  });

export const resendCooldown = (): HttpException =>
  new ForbiddenException({
    code: AUTH_ERROR_CODES.RESEND_COOLDOWN,
    message: 'Please wait before requesting another verification email',
  });

export const invalidEmailVerificationToken = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.INVALID_EMAIL_VERIFICATION_TOKEN,
    message: 'Invalid email verification token',
  });

export const emailVerificationTokenExpired = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.EMAIL_VERIFICATION_TOKEN_EXPIRED,
    message: 'Email verification token has expired',
  });

export const invalidPasswordResetToken = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN,
    message: 'Invalid password reset token',
  });

export const passwordResetTokenExpired = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED,
    message: 'Password reset token has expired',
  });

export const passwordResetTokenUsed = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.PASSWORD_RESET_TOKEN_USED,
    message: 'Password reset token has already been used',
  });

export const invalidOAuthHandoffCode = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.INVALID_OAUTH_HANDOFF_CODE,
    message: 'Invalid OAuth handoff code',
  });

export const oauthHandoffCodeExpired = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.OAUTH_HANDOFF_CODE_EXPIRED,
    message: 'OAuth handoff code has expired',
  });

export const googleOauthNotConfigured = (): ServiceUnavailableException =>
  new ServiceUnavailableException({
    code: AUTH_ERROR_CODES.GOOGLE_OAUTH_NOT_CONFIGURED,
    message: 'Google OAuth is not configured',
  });

export const googleEmailNotVerified = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.GOOGLE_EMAIL_NOT_VERIFIED,
    message: 'Google has not verified this email address',
  });

export const googleAccountAlreadyLinked = (): ConflictException =>
  new ConflictException({
    code: AUTH_ERROR_CODES.GOOGLE_ACCOUNT_ALREADY_LINKED,
    message: 'This email is already linked to a different Google account',
  });

export const invalidOauthState = (): BadRequestException =>
  new BadRequestException({
    code: AUTH_ERROR_CODES.INVALID_OAUTH_STATE,
    message: 'Invalid OAuth state',
  });
