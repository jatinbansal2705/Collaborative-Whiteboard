import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

export const AUTH_ERROR_CODES = {
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

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
