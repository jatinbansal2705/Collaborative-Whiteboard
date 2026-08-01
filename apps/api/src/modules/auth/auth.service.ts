import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from 'argon2';
import type { Session, User } from '../../generated/prisma/client';
import { parseDurationToMs } from '../../common/utils/duration';
import { EmailService } from '../email/email.service';
import {
  accountDisabled,
  emailAlreadyRegistered,
  emailAlreadyVerified,
  emailNotVerified,
  googleAccountAlreadyLinked,
  googleEmailNotVerified,
  invalidCredentials,
  invalidEmailVerificationToken,
  invalidOAuthHandoffCode,
  invalidPasswordResetToken,
  invalidRefreshToken,
  passwordResetTokenExpired,
  passwordResetTokenUsed,
  refreshTokenExpired,
  resendCooldown,
  tokenReuseDetected,
} from './auth.errors';
import { VERIFICATION_RESEND_COOLDOWN_MS } from './auth.constants';
import { TokenService } from './auth-token.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { AuthResult, RefreshResult } from './dto/auth-response.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { GoogleOAuthProfile } from './google/google-oauth.types';
import type { LoginDto } from './dto/login.dto';
import type { MessageResult } from './dto/message-result.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
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
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly emailService: EmailService,
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

    await this.userRepository.update(user.id, {
      verificationSentAt: new Date(),
    });
    await this.sendVerificationEmail(user);

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

    if (user.emailVerifiedAt === null) {
      throw emailNotVerified();
    }

    return this.issueTokens(user, ctx, 'login');
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResult> {
    const verified = await this.tokenService.verifyEmailVerificationToken(
      dto.token,
    );
    const user = await this.userRepository.findById(verified.userId);
    if (user === null || user.email !== verified.email) {
      throw invalidEmailVerificationToken();
    }
    if (user.emailVerifiedAt !== null) {
      throw emailAlreadyVerified();
    }

    await this.userRepository.update(user.id, {
      emailVerifiedAt: new Date(),
    });
    return { message: 'Email verified' };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<MessageResult> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (user === null || user.emailVerifiedAt !== null) {
      return {
        message:
          'If the email is registered and unverified, a verification link has been sent.',
      };
    }

    if (user.verificationSentAt !== null) {
      const elapsed = Date.now() - user.verificationSentAt.getTime();
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) {
        throw resendCooldown();
      }
    }

    await this.userRepository.update(user.id, {
      verificationSentAt: new Date(),
    });
    await this.sendVerificationEmail(user);
    return { message: 'Verification email sent' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResult> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (user === null || !user.isActive) {
      return {
        message:
          'If an account exists for this email, a password reset link has been sent.',
      };
    }

    const token = this.tokenService.signPasswordResetToken({
      userId: user.id,
      email: user.email,
    });
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.passwordResetExpiresIn()),
    );
    await this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashPasswordResetToken(token),
      expiresAt,
    });

    await this.safelySend(() =>
      this.emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name ?? undefined,
        resetLink: this.resetLink(token),
      }),
    );

    return {
      message:
        'If an account exists for this email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResult> {
    const verified = await this.tokenService.verifyPasswordResetToken(
      dto.token,
    );
    const tokenHash = this.tokenService.hashPasswordResetToken(dto.token);
    const record =
      await this.passwordResetTokenRepository.findByHash(tokenHash);
    if (record === null || record.userId !== verified.userId) {
      throw invalidPasswordResetToken();
    }
    if (record.usedAt !== null) {
      throw passwordResetTokenUsed();
    }
    if (record.expiresAt <= new Date()) {
      throw passwordResetTokenExpired();
    }

    const user = await this.userRepository.findById(verified.userId);
    if (user === null) {
      throw invalidPasswordResetToken();
    }

    const passwordHash = await this.hashPassword(dto.password);
    await this.userRepository.update(user.id, {
      passwordHash,
      emailVerifiedAt: new Date(),
    });
    await this.passwordResetTokenRepository.markUsed(record.id);
    await this.sessionRepository.revokeAllForUser(user.id);

    return { message: 'Password has been reset' };
  }

  async googleOAuthCallback(
    profile: GoogleOAuthProfile,
    ctx: RequestContext,
  ): Promise<string> {
    if (!profile.emailVerified) {
      throw googleEmailNotVerified();
    }

    let user = await this.userRepository.findByGoogleId(profile.googleId);
    if (user === null) {
      user = await this.findOrCreateGoogleUser(profile);
    }

    if (!user.isActive) {
      throw accountDisabled();
    }

    const pair = await this.createSession(user, ctx);
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    return this.tokenService.signOAuthHandoffToken({
      userId: user.id,
      sessionId: pair.sessionId,
      refreshTokenHash: this.tokenService.hashRefreshToken(pair.refreshToken),
    });
  }

  async exchangeOAuthHandoff(
    code: string,
    ctx: RequestContext,
  ): Promise<AuthResult> {
    const verified = await this.tokenService.verifyOAuthHandoffToken(code);

    const session = await this.sessionRepository.findByRefreshTokenHash(
      verified.refreshTokenHash,
    );
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.userId !== verified.userId ||
      session.id !== verified.sessionId
    ) {
      throw invalidOAuthHandoffCode();
    }

    const user = await this.userRepository.findById(verified.userId);
    if (user === null || !user.isActive) {
      throw invalidOAuthHandoffCode();
    }

    const pair = await this.rotateSession(session, user, ctx);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      user: this.toUserResponse(user),
    };
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
      sessionId: session.id,
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
      sessionId: session.id,
    };
  }

  private refreshExpiresIn(): string {
    return this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d';
  }

  private passwordResetExpiresIn(): string {
    return this.configService.get<string>('jwt.passwordResetExpiresIn') ?? '1h';
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('app.frontendUrl') ??
      'http://localhost:3001'
    );
  }

  private async findOrCreateGoogleUser(
    profile: GoogleOAuthProfile,
  ): Promise<User> {
    const existing = await this.userRepository.findByEmail(profile.email);
    if (existing !== null) {
      if (
        existing.googleId !== null &&
        existing.googleId !== profile.googleId
      ) {
        throw googleAccountAlreadyLinked();
      }
      return this.userRepository.update(existing.id, {
        googleId: profile.googleId,
        provider: 'GOOGLE',
        name: profile.name ?? existing.name,
        avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      });
    }

    return this.userRepository.create({
      email: profile.email,
      passwordHash: null,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      provider: 'GOOGLE',
      role: 'USER',
      googleId: profile.googleId,
      emailVerifiedAt: new Date(),
    });
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = this.tokenService.signEmailVerificationToken({
      userId: user.id,
      email: user.email,
    });
    await this.safelySend(() =>
      this.emailService.sendVerificationEmail({
        to: user.email,
        name: user.name ?? undefined,
        verificationLink: this.verificationLink(token),
      }),
    );
  }

  private async safelySend(send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.error(
        'Failed to send email',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private verificationLink(token: string): string {
    return `${this.frontendUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
  }

  private resetLink(token: string): string {
    return `${this.frontendUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
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
