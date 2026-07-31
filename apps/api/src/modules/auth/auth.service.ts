import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from 'argon2';
import type { Session, User } from '../../generated/prisma/client';
import { parseDurationToMs } from '../../common/utils/duration';
import {
  accountDisabled,
  emailAlreadyRegistered,
  invalidCredentials,
  invalidRefreshToken,
  refreshTokenExpired,
  tokenReuseDetected,
} from './auth.errors';
import { TokenService } from './auth-token.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { AuthResult, RefreshResult } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';
import type { TokenPair } from './types/token.types';

export interface RequestContext {
  ip?: string;
  device?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresInMs: number;

  constructor(
    private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.accessExpiresInMs = parseDurationToMs(
      this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
    );
  }

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmailWithDeleted(
      dto.email,
    );
    if (existing !== null) {
      throw emailAlreadyRegistered();
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      provider: 'EMAIL',
      role: 'USER',
    });

    return this.issueTokens(user, ctx, 'register');
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (user === null || user.passwordHash === null) {
      throw invalidCredentials();
    }

    const passwordMatches = await this.verifyPassword(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
      throw invalidCredentials();
    }

    if (!user.isActive) {
      throw accountDisabled();
    }

    return this.issueTokens(user, ctx, 'login');
  }

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<RefreshResult> {
    const verified = await this.tokenService.verifyRefreshToken(refreshToken);

    const presentedHash = this.tokenService.hashRefreshToken(refreshToken);
    const session =
      await this.sessionRepository.findByRefreshTokenHash(presentedHash);

    if (session === null) {
      await this.sessionRepository.revokeFamily(verified.familyId);
      this.logger.warn(
        `Refresh token reuse detected for family=${verified.familyId}`,
      );
      throw tokenReuseDetected();
    }

    if (session.revokedAt !== null) {
      await this.sessionRepository.revokeFamily(session.familyId);
      throw tokenReuseDetected();
    }

    if (session.expiresAt <= new Date()) {
      throw refreshTokenExpired();
    }

    if (
      session.userId !== verified.userId ||
      session.id !== verified.sessionId
    ) {
      await this.sessionRepository.revokeFamily(session.familyId);
      throw tokenReuseDetected();
    }

    const user = await this.userRepository.findById(verified.userId);
    if (user === null) {
      throw invalidRefreshToken();
    }
    if (!user.isActive) {
      throw accountDisabled();
    }

    const pair = await this.rotateSession(session, user, ctx);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.sessionRepository.update(user.sessionId, {
      revokedAt: new Date(),
    });
  }

  async me(user: AuthenticatedUser): Promise<User> {
    const found = await this.userRepository.findById(user.id);
    if (found === null) {
      throw invalidRefreshToken();
    }
    return found;
  }

  private async issueTokens(
    user: User,
    ctx: RequestContext,
    reason: 'register' | 'login',
  ): Promise<AuthResult> {
    const pair = await this.createSession(user, ctx);
    if (reason === 'login') {
      await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    }
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      user: this.toUserResponse(user),
    };
  }

  private async createSession(
    user: User,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.refreshExpiresIn()),
    );

    const refreshToken = this.tokenService.signRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      familyId,
    });

    const session = await this.sessionRepository.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
      familyId,
      device: ctx.device,
      ip: ctx.ip,
      expiresAt,
    });

    const pair: TokenPair = {
      accessToken: this.tokenService.signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        familyId: session.familyId,
      }),
      refreshToken,
      expiresIn: this.accessExpiresInMs,
    };

    this.logger.debug(`Session created family=${session.familyId}`);
    return pair;
  }

  private async rotateSession(
    session: Session,
    user: User,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.refreshExpiresIn()),
    );

    const refreshToken = this.tokenService.signRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      familyId: session.familyId,
    });

    await this.sessionRepository.update(session.id, {
      refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
      lastUsedAt: new Date(),
      device: ctx.device,
      ip: ctx.ip,
      expiresAt,
    });

    return {
      accessToken: this.tokenService.signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        familyId: session.familyId,
      }),
      refreshToken,
      expiresIn: this.accessExpiresInMs,
    };
  }

  private refreshExpiresIn(): string {
    return this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d';
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2Hash(password);
  }

  private async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    return argon2Verify(hash, password);
  }

  private toUserResponse(user: User): AuthResult['user'] {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt,
    };
  }
}
