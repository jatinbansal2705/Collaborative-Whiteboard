import { ConfigService } from '@nestjs/config';
import { hash } from 'argon2';
import type {
  PasswordResetToken,
  Session,
  User,
} from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { TokenService } from './auth-token.service';
import { AUTH_ERROR_CODES } from './auth.errors';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'alice@example.com',
  passwordHash: null,
  name: 'Alice',
  avatarUrl: null,
  provider: 'EMAIL',
  role: 'USER',
  googleId: null,
  emailVerifiedAt: null,
  verificationSentAt: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  userId: 'user-1',
  refreshTokenHash: 'hash-1',
  familyId: 'family-1',
  device: null,
  ip: null,
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  const tokenService = {
    hashRefreshToken: jest.fn(),
    hashPasswordResetToken: jest.fn(),
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    signEmailVerificationToken: jest.fn(),
    signPasswordResetToken: jest.fn(),
    signOAuthHandoffToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    verifyEmailVerificationToken: jest.fn(),
    verifyPasswordResetToken: jest.fn(),
    verifyOAuthHandoffToken: jest.fn(),
  };
  const userRepository = {
    findByEmailWithDeleted: jest.fn(),
    findByEmail: jest.fn(),
    findByGoogleId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const sessionRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const passwordResetTokenRepository = {
    create: jest.fn(),
    findByHash: jest.fn(),
    markUsed: jest.fn(),
  };
  const emailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  const context = { ip: '127.0.0.1', device: 'jest' };

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'jwt.accessExpiresIn':
          return '15m';
        case 'jwt.refreshExpiresIn':
          return '30d';
        case 'jwt.passwordResetExpiresIn':
          return '1h';
        case 'app.frontendUrl':
          return 'http://localhost:3001';
        default:
          return undefined;
      }
    });
    tokenService.hashRefreshToken.mockImplementation(
      (token: string) => `hash-of-${token}`,
    );
    tokenService.hashPasswordResetToken.mockImplementation(
      (token: string) => `prhash-of-${token}`,
    );
    tokenService.signAccessToken.mockReturnValue('access-token');
    tokenService.signRefreshToken.mockReturnValue('refresh-token');
    tokenService.signEmailVerificationToken.mockReturnValue('verify-token');
    tokenService.signPasswordResetToken.mockReturnValue('reset-token');
    tokenService.signOAuthHandoffToken.mockReturnValue('handoff-code');
    emailService.sendVerificationEmail.mockResolvedValue(undefined);
    emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

    service = new AuthService(
      tokenService as unknown as TokenService,
      userRepository as unknown as UserRepository,
      sessionRepository as unknown as SessionRepository,
      passwordResetTokenRepository as unknown as PasswordResetTokenRepository,
      emailService,
      configService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('throws EMAIL_ALREADY_REGISTERED when the email already exists', async () => {
      userRepository.findByEmailWithDeleted.mockResolvedValue(makeUser());

      await expect(
        service.register(
          {
            email: 'alice@example.com',
            password: 'Passw0rd1',
            confirmPassword: 'Passw0rd1',
          },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED },
      });
    });

    it('creates the user with an argon2 password hash and issues tokens', async () => {
      userRepository.findByEmailWithDeleted.mockResolvedValue(null);
      userRepository.create.mockImplementation(
        (data: { passwordHash: string }) =>
          makeUser({ passwordHash: data.passwordHash }),
      );
      sessionRepository.create.mockImplementation(
        (data: { id: string; familyId: string }) =>
          makeSession({ id: data.id, familyId: data.familyId }),
      );

      const result = await service.register(
        {
          email: 'alice@example.com',
          password: 'Passw0rd1',
          confirmPassword: 'Passw0rd1',
          name: 'Alice',
        },
        context,
      );

      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'alice@example.com',
        passwordHash: expect.stringMatching(/^\$argon2/) as string,
        name: 'Alice',
        provider: 'EMAIL',
        role: 'USER',
      });
      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: expect.stringContaining('hash-of-') as string,
          familyId: expect.any(String) as string,
        }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('alice@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('throws INVALID_CREDENTIALS for an unknown email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'nobody@example.com', password: 'Passw0rd1' },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS },
      });
    });

    it('throws INVALID_CREDENTIALS for a wrong password', async () => {
      const hashed = await hash('CorrectPassw0rd1');
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hashed }),
      );

      await expect(
        service.login(
          { email: 'alice@example.com', password: 'WrongPassw0rd1' },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS },
      });
    });

    it('throws ACCOUNT_DISABLED for an inactive account', async () => {
      const hashed = await hash('Passw0rd1');
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hashed, isActive: false }),
      );

      await expect(
        service.login(
          { email: 'alice@example.com', password: 'Passw0rd1' },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.ACCOUNT_DISABLED },
      });
    });

    it('throws EMAIL_NOT_VERIFIED for an unverified account', async () => {
      const hashed = await hash('Passw0rd1');
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hashed }),
      );

      await expect(
        service.login(
          { email: 'alice@example.com', password: 'Passw0rd1' },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED },
      });
    });

    it('updates lastLoginAt and issues a token pair on success', async () => {
      const hashed = await hash('Passw0rd1');
      userRepository.findByEmail.mockResolvedValue(
        makeUser({
          passwordHash: hashed,
          emailVerifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      );
      sessionRepository.create.mockImplementation(
        (data: { id: string; familyId: string }) =>
          makeSession({ id: data.id, familyId: data.familyId }),
      );

      const result = await service.login(
        { email: 'alice@example.com', password: 'Passw0rd1' },
        context,
      );

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          lastLoginAt: expect.any(Date) as Date,
        }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('refresh', () => {
    const verifiedPayload = {
      userId: 'user-1',
      sessionId: 'session-1',
      familyId: 'family-1',
    };

    it('revokes the family and throws TOKEN_REUSE_DETECTED when the hash is unknown', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(verifiedPayload);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(null);

      await expect(
        service.refresh('old-refresh-token', context),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.TOKEN_REUSE_DETECTED },
      });
      expect(sessionRepository.revokeFamily).toHaveBeenCalledWith('family-1');
    });

    it('revokes the family when the token does not match the session row', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(verifiedPayload);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(
        makeSession({
          id: 'other-session',
          userId: 'other-user',
          familyId: 'other-family',
        }),
      );

      await expect(
        service.refresh('stale-refresh-token', context),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.TOKEN_REUSE_DETECTED },
      });
      expect(sessionRepository.revokeFamily).toHaveBeenCalledWith(
        'other-family',
      );
    });

    it('throws REFRESH_TOKEN_EXPIRED when the session has expired', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(verifiedPayload);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(
        makeSession({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
      );

      await expect(
        service.refresh('expired-refresh-token', context),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED },
      });
    });

    it('rotates the token pair and persists the new hash', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(verifiedPayload);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(makeSession());
      userRepository.findById.mockResolvedValue(makeUser());
      tokenService.signRefreshToken.mockReturnValue('new-refresh-token');
      tokenService.hashRefreshToken.mockImplementation(
        (token: string) => `hash-of-${token}`,
      );

      const result = await service.refresh('old-refresh-token', context);

      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.accessToken).toBe('access-token');
      expect(sessionRepository.update).toHaveBeenCalledWith('session-1', {
        refreshTokenHash: 'hash-of-new-refresh-token',
        lastUsedAt: expect.any(Date) as Date,
        device: 'jest',
        ip: '127.0.0.1',
        expiresAt: expect.any(Date) as Date,
      });
    });
  });

  describe('logout', () => {
    it('revokes the current session', async () => {
      await service.logout({
        id: 'user-1',
        email: 'a@b.c',
        role: 'USER',
        sessionId: 'session-1',
      });

      expect(sessionRepository.update).toHaveBeenCalledWith('session-1', {
        revokedAt: expect.any(Date) as Date,
      });
    });
  });

  describe('me', () => {
    it('returns the user profile', async () => {
      userRepository.findById.mockResolvedValue(makeUser());

      const result = await service.me({
        id: 'user-1',
        email: 'alice@example.com',
        role: 'USER',
        sessionId: 'session-1',
      });

      expect(result.email).toBe('alice@example.com');
    });

    it('throws when the user no longer exists', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.me({
          id: 'user-1',
          email: 'alice@example.com',
          role: 'USER',
          sessionId: 'session-1',
        }),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN },
      });
    });
  });

  describe('verifyEmail', () => {
    const verifiedToken = {
      userId: 'user-1',
      email: 'alice@example.com',
      jti: 'jti-1',
    };

    it('marks the email as verified', async () => {
      tokenService.verifyEmailVerificationToken.mockResolvedValue(
        verifiedToken,
      );
      userRepository.findById.mockResolvedValue(makeUser());

      const result = await service.verifyEmail({ token: 'token-1' });

      expect(result.message).toBe('Email verified');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        emailVerifiedAt: expect.any(Date) as Date,
      });
    });

    it('throws INVALID_EMAIL_VERIFICATION_TOKEN when the email changed', async () => {
      tokenService.verifyEmailVerificationToken.mockResolvedValue(
        verifiedToken,
      );
      userRepository.findById.mockResolvedValue(
        makeUser({ email: 'bob@example.com' }),
      );

      await expect(
        service.verifyEmail({ token: 'token-1' }),
      ).rejects.toMatchObject({
        response: {
          code: AUTH_ERROR_CODES.INVALID_EMAIL_VERIFICATION_TOKEN,
        },
      });
    });

    it('throws EMAIL_ALREADY_VERIFIED for a verified account', async () => {
      tokenService.verifyEmailVerificationToken.mockResolvedValue(
        verifiedToken,
      );
      userRepository.findById.mockResolvedValue(
        makeUser({ emailVerifiedAt: new Date('2026-01-02T00:00:00.000Z') }),
      );

      await expect(
        service.verifyEmail({ token: 'token-1' }),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED },
      });
    });
  });

  describe('resendVerification', () => {
    it('returns a generic message for an unknown email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({
        email: 'nobody@example.com',
      });

      expect(result.message).toContain('verification link');
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns a generic message for a verified account', async () => {
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ emailVerifiedAt: new Date('2026-01-02T00:00:00.000Z') }),
      );

      const result = await service.resendVerification({
        email: 'alice@example.com',
      });

      expect(result.message).toContain('verification link');
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('throws RESEND_COOLDOWN when a verification email was sent recently', async () => {
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ verificationSentAt: new Date() }),
      );

      await expect(
        service.resendVerification({ email: 'alice@example.com' }),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.RESEND_COOLDOWN },
      });
    });

    it('sends a verification email and records verificationSentAt', async () => {
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ verificationSentAt: new Date('2020-01-01T00:00:00.000Z') }),
      );
      userRepository.update.mockImplementation(
        (id: string, data: Partial<User>) => makeUser({ ...data, id }),
      );

      const result = await service.resendVerification({
        email: 'alice@example.com',
      });

      expect(result.message).toBe('Verification email sent');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        verificationSentAt: expect.any(Date) as Date,
      });
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith({
        to: 'alice@example.com',
        name: 'Alice',
        verificationLink:
          'http://localhost:3001/auth/verify-email?token=verify-token',
      });
    });
  });

  describe('forgotPassword', () => {
    it('returns a generic message for an unknown email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(result.message).toContain('password reset link');
      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    });

    it('creates a hashed reset record and sends the reset email', async () => {
      userRepository.findByEmail.mockResolvedValue(makeUser());
      passwordResetTokenRepository.create.mockResolvedValue({
        id: 'pr-1',
        userId: 'user-1',
        tokenHash: 'prhash-of-reset-token',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      const result = await service.forgotPassword({
        email: 'alice@example.com',
      });

      expect(result.message).toContain('password reset link');
      expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: 'prhash-of-reset-token',
          expiresAt: expect.any(Date) as Date,
        }),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith({
        to: 'alice@example.com',
        name: 'Alice',
        resetLink:
          'http://localhost:3001/auth/reset-password?token=reset-token',
      });
    });

    it('returns a generic message when email delivery fails', async () => {
      userRepository.findByEmail.mockResolvedValue(makeUser());
      passwordResetTokenRepository.create.mockResolvedValue({
        id: 'pr-1',
        userId: 'user-1',
        tokenHash: 'prhash-of-reset-token',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });
      emailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('smtp down'),
      );

      const result = await service.forgotPassword({
        email: 'alice@example.com',
      });

      expect(result.message).toContain('password reset link');
    });
  });

  describe('resetPassword', () => {
    const resetRecord = (overrides: Partial<PasswordResetToken> = {}) => ({
      id: 'pr-1',
      userId: 'user-1',
      tokenHash: 'prhash-of-reset-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      usedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });

    const dto = {
      token: 'reset-token',
      password: 'NewPassw0rd1',
      confirmPassword: 'NewPassw0rd1',
    };

    beforeEach(() => {
      tokenService.verifyPasswordResetToken.mockResolvedValue({
        userId: 'user-1',
        email: 'alice@example.com',
        jti: 'jti-1',
      });
      passwordResetTokenRepository.findByHash.mockResolvedValue(resetRecord());
    });

    it('throws INVALID_PASSWORD_RESET_TOKEN when the record is unknown', async () => {
      passwordResetTokenRepository.findByHash.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN },
      });
    });

    it('throws PASSWORD_RESET_TOKEN_USED for a consumed token', async () => {
      passwordResetTokenRepository.findByHash.mockResolvedValue(
        resetRecord({ usedAt: new Date('2026-01-02T00:00:00.000Z') }),
      );

      await expect(service.resetPassword(dto)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.PASSWORD_RESET_TOKEN_USED },
      });
    });

    it('throws PASSWORD_RESET_TOKEN_EXPIRED for an expired token', async () => {
      passwordResetTokenRepository.findByHash.mockResolvedValue(
        resetRecord({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
      );

      await expect(service.resetPassword(dto)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED },
      });
    });

    it('rehashes the password, marks the token used, and revokes sessions', async () => {
      userRepository.findById.mockResolvedValue(makeUser());
      userRepository.update.mockImplementation(
        (id: string, data: Partial<User>) => makeUser({ ...data, id }),
      );
      passwordResetTokenRepository.markUsed.mockResolvedValue(
        resetRecord({ usedAt: new Date() }),
      );

      const result = await service.resetPassword(dto);

      expect(result.message).toBe('Password has been reset');
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          passwordHash: expect.stringMatching(/^\$argon2/) as string,
          emailVerifiedAt: expect.any(Date) as Date,
        }),
      );
      expect(passwordResetTokenRepository.markUsed).toHaveBeenCalledWith(
        'pr-1',
      );
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('googleOAuthCallback', () => {
    const googleProfile = {
      googleId: 'google-1',
      email: 'alice@example.com',
      emailVerified: true,
    };

    it('throws GOOGLE_EMAIL_NOT_VERIFIED for an unverified email', async () => {
      await expect(
        service.googleOAuthCallback(
          { ...googleProfile, emailVerified: false },
          context,
        ),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.GOOGLE_EMAIL_NOT_VERIFIED },
      });
    });

    it('creates a user, a session, and returns a handoff code', async () => {
      userRepository.findByGoogleId.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockImplementation((data: Partial<User>) =>
        makeUser({
          email: data.email as string,
          googleId: data.googleId ?? null,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
        }),
      );
      sessionRepository.create.mockImplementation(
        (data: { id: string; familyId: string }) =>
          makeSession({ id: data.id, familyId: data.familyId }),
      );

      const result = await service.googleOAuthCallback(googleProfile, context);

      expect(result).toBe('handoff-code');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alice@example.com',
          googleId: 'google-1',
          provider: 'GOOGLE',
          emailVerifiedAt: expect.any(Date) as Date,
        }),
      );
      expect(tokenService.signOAuthHandoffToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: 'hash-of-refresh-token',
        }),
      );
    });

    it('links an existing password account to the Google profile', async () => {
      userRepository.findByGoogleId.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(makeUser());
      userRepository.update.mockImplementation(
        (id: string, data: Partial<User>) => makeUser({ ...data, id }),
      );
      sessionRepository.create.mockImplementation(
        (data: { id: string; familyId: string }) =>
          makeSession({ id: data.id, familyId: data.familyId }),
      );

      await service.googleOAuthCallback(googleProfile, context);

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          googleId: 'google-1',
          provider: 'GOOGLE',
        }),
      );
    });

    it('throws GOOGLE_ACCOUNT_ALREADY_LINKED on a conflicting googleId', async () => {
      userRepository.findByGoogleId.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ googleId: 'other-google' }),
      );

      await expect(
        service.googleOAuthCallback(googleProfile, context),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.GOOGLE_ACCOUNT_ALREADY_LINKED },
      });
    });
  });

  describe('exchangeOAuthHandoff', () => {
    const verified = {
      userId: 'user-1',
      sessionId: 'session-1',
      refreshTokenHash: 'hash-of-refresh-token',
    };

    it('throws INVALID_OAUTH_HANDOFF_CODE when the session is unknown', async () => {
      tokenService.verifyOAuthHandoffToken.mockResolvedValue(verified);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(null);

      await expect(
        service.exchangeOAuthHandoff('code-1', context),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_OAUTH_HANDOFF_CODE },
      });
    });

    it('rotates the session and returns tokens', async () => {
      tokenService.verifyOAuthHandoffToken.mockResolvedValue(verified);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(makeSession());
      userRepository.findById.mockResolvedValue(makeUser());
      tokenService.signRefreshToken.mockReturnValue('new-refresh-token');
      sessionRepository.update.mockImplementation(
        (id: string, data: Partial<Session>) => makeSession({ id, ...data }),
      );

      const result = await service.exchangeOAuthHandoff('code-1', context);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.user.email).toBe('alice@example.com');
      expect(sessionRepository.update).toHaveBeenCalledWith('session-1', {
        refreshTokenHash: 'hash-of-new-refresh-token',
        lastUsedAt: expect.any(Date) as Date,
        device: 'jest',
        ip: '127.0.0.1',
        expiresAt: expect.any(Date) as Date,
      });
    });
  });
});
