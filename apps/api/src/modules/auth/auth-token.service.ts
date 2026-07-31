import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { StringValue } from 'ms';
import type { UserRole } from '../../generated/prisma/client';
import {
  accessTokenExpiredError,
  invalidAccessToken,
  invalidRefreshTokenError,
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

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: StringValue;
  refreshSecret: string;
  refreshExpiresIn: StringValue;
  issuer: string;
  audience: string;
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
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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

  private isTokenExpired(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TokenExpiredError'
    );
  }
}
