import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { StringValue } from 'ms';
import type { UserRole } from '../../generated/prisma/client';
import {
  accessTokenExpiredError,
  emailVerificationTokenExpired,
  invalidAccessToken,
  invalidEmailVerificationToken,
  invalidOAuthHandoffCode,
  invalidPasswordResetToken,
  invalidRefreshTokenError,
  oauthHandoffCodeExpired,
  passwordResetTokenExpired,
  refreshTokenExpiredError,
} from './auth.errors';

export interface AccessTokenVerified {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface RefreshTokenVerified {
  userId: string;
  sessionId: string;
  familyId: string;
}

export interface EmailVerificationTokenVerified {
  userId: string;
  email: string;
  jti: string;
}

export interface PasswordResetTokenVerified {
  userId: string;
  email: string;
  jti: string;
}

export interface OAuthHandoffTokenVerified {
  userId: string;
  sessionId: string;
  refreshTokenHash: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: StringValue;
  refreshSecret: string;
  refreshExpiresIn: StringValue;
  issuer: string;
  audience: string;
  emailSecret: string;
  emailExpiresIn: StringValue;
  passwordResetSecret: string;
  passwordResetExpiresIn: StringValue;
  oauthHandoffSecret: string;
  oauthHandoffExpiresIn: StringValue;
}

export interface TokenOptions {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  familyId: string;
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: StringValue;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: StringValue;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly emailSecret: string;
  private readonly emailExpiresIn: StringValue;
  private readonly passwordResetSecret: string;
  private readonly passwordResetExpiresIn: StringValue;
  private readonly oauthHandoffSecret: string;
  private readonly oauthHandoffExpiresIn: StringValue;

  constructor(
    private readonly jwtService: JwtService,
    jwtConfig: JwtConfig,
  ) {
    this.accessSecret = jwtConfig.accessSecret;
    this.accessExpiresIn = jwtConfig.accessExpiresIn;
    this.refreshSecret = jwtConfig.refreshSecret;
    this.refreshExpiresIn = jwtConfig.refreshExpiresIn;
    this.issuer = jwtConfig.issuer;
    this.audience = jwtConfig.audience;
    this.emailSecret = jwtConfig.emailSecret;
    this.emailExpiresIn = jwtConfig.emailExpiresIn;
    this.passwordResetSecret = jwtConfig.passwordResetSecret;
    this.passwordResetExpiresIn = jwtConfig.passwordResetExpiresIn;
    this.oauthHandoffSecret = jwtConfig.oauthHandoffSecret;
    this.oauthHandoffExpiresIn = jwtConfig.oauthHandoffExpiresIn;
  }

  hashRefreshToken(token: string): string {
    return this.sha256(token);
  }

  hashPasswordResetToken(token: string): string {
    return this.sha256(token);
  }

  signAccessToken(options: TokenOptions): string {
    return this.jwtService.sign(
      {
        email: options.email,
        role: options.role,
        sid: options.sessionId,
      },
      {
        subject: options.userId,
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  signRefreshToken(options: TokenOptions): string {
    return this.jwtService.sign(
      {
        fam: options.familyId,
        typ: 'refresh',
        nonce: randomUUID(),
      },
      {
        subject: options.userId,
        jwtid: options.sessionId,
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  signEmailVerificationToken(options: {
    userId: string;
    email: string;
  }): string {
    return this.jwtService.sign(
      { typ: 'email-verify', email: options.email },
      {
        subject: options.userId,
        jwtid: randomUUID(),
        secret: this.emailSecret,
        expiresIn: this.emailExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  signPasswordResetToken(options: { userId: string; email: string }): string {
    return this.jwtService.sign(
      { typ: 'password-reset', email: options.email },
      {
        subject: options.userId,
        jwtid: randomUUID(),
        secret: this.passwordResetSecret,
        expiresIn: this.passwordResetExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  signOAuthHandoffToken(options: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
  }): string {
    return this.jwtService.sign(
      {
        typ: 'oauth-handoff',
        sid: options.sessionId,
        rth: options.refreshTokenHash,
      },
      {
        subject: options.userId,
        jwtid: randomUUID(),
        secret: this.oauthHandoffSecret,
        expiresIn: this.oauthHandoffExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenVerified> {
    let payload: {
      sub: string;
      email: string;
      role: UserRole;
      sid: string;
    };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: UserRole;
        sid: string;
      }>(token, {
        secret: this.accessSecret,
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      if (this.isTokenExpired(error)) {
        throw accessTokenExpiredError();
      }
      throw invalidAccessToken();
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      throw invalidAccessToken();
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sid,
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenVerified> {
    let payload: { sub: string; jti: string; fam: string; typ: string };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        jti: string;
        fam: string;
        typ: string;
      }>(token, {
        secret: this.refreshSecret,
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      if (this.isTokenExpired(error)) {
        throw refreshTokenExpiredError();
      }
      throw invalidRefreshTokenError();
    }

    if (
      payload.typ !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.fam !== 'string'
    ) {
      throw invalidRefreshTokenError();
    }

    return {
      userId: payload.sub,
      sessionId: payload.jti,
      familyId: payload.fam,
    };
  }

  async verifyEmailVerificationToken(
    token: string,
  ): Promise<EmailVerificationTokenVerified> {
    let payload: { sub: string; jti: string; email: string; typ: string };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        jti: string;
        email: string;
        typ: string;
      }>(token, {
        secret: this.emailSecret,
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      if (this.isTokenExpired(error)) {
        throw emailVerificationTokenExpired();
      }
      throw invalidEmailVerificationToken();
    }

    if (
      payload.typ !== 'email-verify' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw invalidEmailVerificationToken();
    }

    return {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
    };
  }

  async verifyPasswordResetToken(
    token: string,
  ): Promise<PasswordResetTokenVerified> {
    let payload: { sub: string; jti: string; email: string; typ: string };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        jti: string;
        email: string;
        typ: string;
      }>(token, {
        secret: this.passwordResetSecret,
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      if (this.isTokenExpired(error)) {
        throw passwordResetTokenExpired();
      }
      throw invalidPasswordResetToken();
    }

    if (
      payload.typ !== 'password-reset' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw invalidPasswordResetToken();
    }

    return {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
    };
  }

  async verifyOAuthHandoffToken(
    token: string,
  ): Promise<OAuthHandoffTokenVerified> {
    let payload: {
      sub: string;
      jti: string;
      sid: string;
      rth: string;
      typ: string;
    };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        jti: string;
        sid: string;
        rth: string;
        typ: string;
      }>(token, {
        secret: this.oauthHandoffSecret,
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      if (this.isTokenExpired(error)) {
        throw oauthHandoffCodeExpired();
      }
      throw invalidOAuthHandoffCode();
    }

    if (
      payload.typ !== 'oauth-handoff' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.rth !== 'string'
    ) {
      throw invalidOAuthHandoffCode();
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      refreshTokenHash: payload.rth,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isTokenExpired(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TokenExpiredError'
    );
  }
}
