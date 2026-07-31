import { ConfigService } from '@nestjs/config';
import { hash } from 'argon2';
import type { Session, User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { TokenService } from './auth-token.service';
import { AUTH_ERROR_CODES } from './auth.errors';
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
  emailVerifiedAt: null,
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
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const userRepository = {
    findByEmailWithDeleted: jest.fn(),
    findByEmail: jest.fn(),
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
        default:
          return undefined;
      }
    });
    tokenService.hashRefreshToken.mockImplementation(
      (token: string) => `hash-of-${token}`,
    );
    tokenService.signAccessToken.mockReturnValue('access-token');
    tokenService.signRefreshToken.mockReturnValue('refresh-token');

    service = new AuthService(
      tokenService as unknown as TokenService,
      userRepository as unknown as UserRepository,
      sessionRepository as unknown as SessionRepository,
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

    it('updates lastLoginAt and issues a token pair on success', async () => {
      const hashed = await hash('Passw0rd1');
      userRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hashed }),
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
});
