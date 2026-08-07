import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../src/common/types/api-response.type';
import { TokenService } from '../src/modules/auth/auth-token.service';

process.env.DATABASE_URL ??=
  'postgresql://whiteboard:whiteboard@localhost:5432/whiteboard?schema=public';

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  role: string;
  emailVerifiedAt: Date | null;
  verificationSentAt: Date | null;
  googleId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface FakeSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  device: string | null;
  ip: string | null;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakePasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type UserWhere = {
  id?: string;
  email?: string;
  googleId?: string;
  deletedAt?: Date | null;
};

type SessionWhere = {
  id?: string;
  refreshTokenHash?: string;
  familyId?: string;
  revokedAt?: Date | null;
};

type PasswordResetTokenWhere = {
  id?: string;
  tokenHash?: string;
};

class FakePrismaService {
  users = new Map<string, FakeUser>();
  sessions = new Map<string, FakeSession>();
  passwordResetTokens = new Map<string, FakePasswordResetToken>();

  reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.passwordResetTokens.clear();
  }

  findUserByEmail(email: string): FakeUser | null {
    const rows = [...this.users.values()];
    return (
      rows.find((user) => user.email.toLowerCase() === email.toLowerCase()) ??
      null
    );
  }

  readonly user = {
    findFirst: ({ where }: { where: UserWhere }): FakeUser | null =>
      this.findUser(where),
    findUnique: ({ where }: { where: UserWhere }): FakeUser | null =>
      this.findUser(where),
    create: ({
      data,
    }: {
      data: Partial<FakeUser> & { email: string };
    }): FakeUser => {
      const now = new Date();
      const user: FakeUser = {
        id: data.id ?? randomUUID(),
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        name: data.name ?? null,
        avatarUrl: data.avatarUrl ?? null,
        provider: data.provider ?? 'EMAIL',
        role: data.role ?? 'USER',
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        verificationSentAt: data.verificationSentAt ?? null,
        googleId: data.googleId ?? null,
        isActive: data.isActive ?? true,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.users.set(user.id, user);
      return user;
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeUser>;
    }): FakeUser => {
      const existing = this.users.get(where.id);
      if (existing === undefined) {
        throw new Error('User not found');
      }
      const updated: FakeUser = { ...existing, ...data, updatedAt: new Date() };
      this.users.set(updated.id, updated);
      return updated;
    },
  };

  readonly session = {
    findUnique: ({ where }: { where: SessionWhere }): FakeSession | null =>
      this.findSession(where),
    findFirst: ({ where }: { where: SessionWhere }): FakeSession | null =>
      this.findSession(where),
    findMany: ({ where }: { where: SessionWhere }): FakeSession[] => {
      const rows = [...this.sessions.values()];
      return rows.filter((session) => this.matchesSession(session, where));
    },
    create: ({
      data,
    }: {
      data: Partial<FakeSession> & {
        userId: string;
        refreshTokenHash: string;
        familyId: string;
        expiresAt: Date;
      };
    }): FakeSession => {
      const now = new Date();
      const session: FakeSession = {
        id: data.id ?? randomUUID(),
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        familyId: data.familyId,
        device: data.device ?? null,
        ip: data.ip ?? null,
        expiresAt: data.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.sessions.set(session.id, session);
      return session;
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeSession>;
    }): FakeSession => {
      const existing = this.sessions.get(where.id);
      if (existing === undefined) {
        throw new Error('Session not found');
      }
      const updated: FakeSession = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      this.sessions.set(updated.id, updated);
      return updated;
    },
    updateMany: ({
      where,
      data,
    }: {
      where: SessionWhere;
      data: Partial<FakeSession>;
    }): { count: number } => {
      let count = 0;
      for (const session of this.sessions.values()) {
        if (this.matchesSession(session, where)) {
          this.sessions.set(session.id, {
            ...session,
            ...data,
            updatedAt: new Date(),
          });
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly passwordResetToken = {
    findUnique: ({
      where,
    }: {
      where: PasswordResetTokenWhere;
    }): FakePasswordResetToken | null => {
      const rows = [...this.passwordResetTokens.values()];
      return (
        rows.find(
          (token) =>
            (where.id === undefined || token.id === where.id) &&
            (where.tokenHash === undefined ||
              token.tokenHash === where.tokenHash),
        ) ?? null
      );
    },
    create: ({
      data,
    }: {
      data: Partial<FakePasswordResetToken> & {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
      };
    }): FakePasswordResetToken => {
      const now = new Date();
      const token: FakePasswordResetToken = {
        id: data.id ?? randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.passwordResetTokens.set(token.id, token);
      return token;
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakePasswordResetToken>;
    }): FakePasswordResetToken => {
      const existing = this.passwordResetTokens.get(where.id);
      if (existing === undefined) {
        throw new Error('Password reset token not found');
      }
      const updated: FakePasswordResetToken = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      this.passwordResetTokens.set(updated.id, updated);
      return updated;
    },
  };

  private findUser(where: UserWhere): FakeUser | null {
    const rows = [...this.users.values()];
    const match = rows.find(
      (user) =>
        (where.id === undefined || user.id === where.id) &&
        (where.email === undefined ||
          user.email.toLowerCase() === where.email.toLowerCase()) &&
        (where.googleId === undefined || user.googleId === where.googleId) &&
        (where.deletedAt === undefined || user.deletedAt === where.deletedAt),
    );
    return match ?? null;
  }

  private findSession(where: SessionWhere): FakeSession | null {
    const rows = [...this.sessions.values()];
    const match = rows.find((session) => this.matchesSession(session, where));
    return match ?? null;
  }

  private matchesSession(session: FakeSession, where: SessionWhere): boolean {
    return (
      (where.id === undefined || session.id === where.id) &&
      (where.refreshTokenHash === undefined ||
        session.refreshTokenHash === where.refreshTokenHash) &&
      (where.familyId === undefined || session.familyId === where.familyId) &&
      (where.revokedAt === undefined || session.revokedAt === where.revokedAt)
    );
  }
}

const readSuccess = <T>(response: request.Response): ApiSuccessResponse<T> =>
  response.body as ApiSuccessResponse<T>;

const readError = (response: request.Response): ApiErrorResponse =>
  response.body as ApiErrorResponse;

const WELL_FORMED_FAKE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJub3QtYS1yZWFsLXRva2VuIn0.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; role: string };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let tokenService: TokenService;
  const fakePrisma = new FakePrismaService();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    tokenService = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakePrisma.reset();
  });

  const register = (
    email: string,
    password = 'StrongPassw0rd1',
  ): request.Test =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, confirmPassword: password });

  const login = (email: string, password = 'StrongPassw0rd1'): request.Test =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

  const verifyEmailOf = async (
    userId: string,
    email: string,
  ): Promise<void> => {
    const token = tokenService.signEmailVerificationToken({ userId, email });
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(201);
  };

  const registerAndLogin = async (
    email: string,
  ): Promise<{ auth: AuthBody; password: string }> => {
    const password = 'StrongPassw0rd1';
    const regResponse = await register(email, password).expect(201);
    const regData = readSuccess<AuthBody>(regResponse).data;
    await verifyEmailOf(regData.user.id, email);
    const response = await login(email, password).expect(201);
    return { auth: readSuccess<AuthBody>(response).data, password };
  };

  it('registers a user and stores an argon2 password hash', async () => {
    const response = await register('alice@example.com').expect(201);
    const data = readSuccess<AuthBody>(response).data;

    expect(data.user.email).toBe('alice@example.com');
    expect(data.user.role).toBe('USER');
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.expiresIn).toBeGreaterThan(0);

    const stored = fakePrisma.findUserByEmail('alice@example.com');
    expect(stored?.passwordHash).toMatch(/^\$argon2/);
    expect(stored?.passwordHash).not.toContain('StrongPassw0rd1');
    expect(stored?.emailVerifiedAt).toBeNull();
  });

  it('rejects a duplicate registration with EMAIL_ALREADY_REGISTERED', async () => {
    await register('bob@example.com').expect(201);

    const response = await register('BOB@example.com').expect(409);
    expect(readError(response).error).toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
    });
  });

  it('rejects invalid credentials with INVALID_CREDENTIALS', async () => {
    await register('carol@example.com').expect(201);

    const response = await login('carol@example.com', 'WrongPassw0rd1').expect(
      401,
    );
    expect(readError(response).error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('blocks login until the email is verified with EMAIL_NOT_VERIFIED', async () => {
    await register('grace@example.com').expect(201);

    const response = await login('grace@example.com').expect(403);
    expect(readError(response).error).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('returns the current user from /auth/me', async () => {
    const { auth } = await registerAndLogin('dave@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const data = readSuccess<{ email: string }>(response).data;
    expect(data.email).toBe('dave@example.com');
  });

  it('rejects /auth/me without a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(readError(response).error.code).toBe('UNAUTHORIZED');
  });

  it('verifies an email and allows login', async () => {
    await register('heidi@example.com').expect(201);
    const stored = fakePrisma.findUserByEmail('heidi@example.com');
    expect(stored?.emailVerifiedAt).toBeNull();

    await verifyEmailOf(stored!.id, 'heidi@example.com');

    const updated = fakePrisma.findUserByEmail('heidi@example.com');
    expect(updated?.emailVerifiedAt).not.toBeNull();
    await login('heidi@example.com').expect(201);
  });

  it('rejects an invalid verification token with INVALID_EMAIL_VERIFICATION_TOKEN', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: WELL_FORMED_FAKE_JWT })
      .expect(400);

    expect(readError(response).error).toMatchObject({
      code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
    });
  });

  it('rejects re-verifying an already verified email with EMAIL_ALREADY_VERIFIED', async () => {
    const regResponse = await register('ivan@example.com').expect(201);
    const regData = readSuccess<AuthBody>(regResponse).data;
    await verifyEmailOf(regData.user.id, 'ivan@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({
        token: tokenService.signEmailVerificationToken({
          userId: regData.user.id,
          email: 'ivan@example.com',
        }),
      })
      .expect(409);

    expect(readError(response).error).toMatchObject({
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  });

  it('resends a verification email after the cooldown', async () => {
    await register('judy@example.com').expect(201);
    const stored = fakePrisma.findUserByEmail('judy@example.com');
    fakePrisma.user.update({
      where: { id: stored!.id },
      data: { verificationSentAt: new Date(Date.now() - 2 * 60_000) },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'judy@example.com' })
      .expect(201);

    expect(readSuccess<{ message: string }>(response).data.message).toContain(
      'sent',
    );
    const updated = fakePrisma.findUserByEmail('judy@example.com');
    expect(updated?.verificationSentAt).not.toBeNull();
  });

  it('enforces the resend cooldown with RESEND_COOLDOWN', async () => {
    await register('karl@example.com').expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'karl@example.com' })
      .expect(403);

    expect(readError(response).error).toMatchObject({
      code: 'RESEND_COOLDOWN',
    });
  });

  it('forgot-password stores a hashed token and returns a generic message', async () => {
    const regResponse = await register('lisa@example.com').expect(201);
    const regData = readSuccess<AuthBody>(regResponse).data;
    await verifyEmailOf(regData.user.id, 'lisa@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'lisa@example.com' })
      .expect(201);

    expect(readSuccess<{ message: string }>(response).data.message).toContain(
      'reset',
    );
    const tokens = [...fakePrisma.passwordResetTokens.values()];
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe(regData.user.id);
    expect(tokens[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('forgot-password hides unknown accounts behind a generic message', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(201);

    expect(readSuccess<{ message: string }>(response).data.message).toContain(
      'reset',
    );
    expect(fakePrisma.passwordResetTokens.size).toBe(0);
  });

  it('reset-password changes the password and revokes sessions', async () => {
    const { auth } = await registerAndLogin('mike@example.com');

    const rawToken = tokenService.signPasswordResetToken({
      userId: auth.user.id,
      email: 'mike@example.com',
    });
    fakePrisma.passwordResetToken.create({
      data: {
        userId: auth.user.id,
        tokenHash: tokenService.hashPasswordResetToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const newPassword = 'NewPassw0rd2!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        password: newPassword,
        confirmPassword: newPassword,
      })
      .expect(201);

    const oldSession = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(401);
    expect(readError(oldSession).error.code).toBe('UNAUTHORIZED');

    const relogin = await login('mike@example.com', newPassword).expect(201);
    expect(readSuccess<AuthBody>(relogin).data.accessToken).toBeTruthy();
  });

  it('rejects reset-password with an invalid token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: WELL_FORMED_FAKE_JWT,
        password: 'NewPassw0rd2!',
        confirmPassword: 'NewPassw0rd2!',
      })
      .expect(400);

    expect(readError(response).error).toMatchObject({
      code: 'INVALID_PASSWORD_RESET_TOKEN',
    });
  });

  it('rejects reset-password with an already used token', async () => {
    const regResponse = await register('nina@example.com').expect(201);
    const regData = readSuccess<AuthBody>(regResponse).data;
    const rawToken = tokenService.signPasswordResetToken({
      userId: regData.user.id,
      email: 'nina@example.com',
    });
    fakePrisma.passwordResetToken.create({
      data: {
        userId: regData.user.id,
        tokenHash: tokenService.hashPasswordResetToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const body = {
      token: rawToken,
      password: 'NewPassw0rd2!',
      confirmPassword: 'NewPassw0rd2!',
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send(body)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send(body)
      .expect(400);

    expect(readError(response).error).toMatchObject({
      code: 'PASSWORD_RESET_TOKEN_USED',
    });
  });

  it('redirects to Google and sets a state cookie on /auth/google', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/google')
      .expect(302);

    expect(response.headers.location).toContain('accounts.google.com');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.join('')).toContain('whiteboard_oauth_state=');
  });

  it('rejects /auth/google/callback without a code with INVALID_OAUTH_STATE', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/google/callback')
      .expect(400);

    expect(readError(response).error).toMatchObject({
      code: 'INVALID_OAUTH_STATE',
    });
  });

  it('exchanges a valid handoff code for tokens via /auth/google/exchange', async () => {
    const user = fakePrisma.user.create({
      data: {
        email: 'google-user@example.com',
        provider: 'GOOGLE',
        googleId: 'google-id-1',
        emailVerifiedAt: new Date(),
        passwordHash: null,
      },
    });
    const sessionId = randomUUID();
    const refreshTokenHash =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    fakePrisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });

    const code = tokenService.signOAuthHandoffToken({
      userId: user.id,
      sessionId,
      refreshTokenHash,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google/exchange')
      .send({ code })
      .expect(201);

    const data = readSuccess<AuthBody>(response).data;
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.user.email).toBe('google-user@example.com');
  });

  it('rejects an invalid handoff code with INVALID_OAUTH_HANDOFF_CODE', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google/exchange')
      .send({ code: WELL_FORMED_FAKE_JWT })
      .expect(400);

    expect(readError(response).error).toMatchObject({
      code: 'INVALID_OAUTH_HANDOFF_CODE',
    });
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { auth } = await registerAndLogin('erin@example.com');

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(201);
    const rotatedData = readSuccess<{
      refreshToken: string;
      accessToken: string;
    }>(rotated).data;

    expect(rotatedData.refreshToken).not.toBe(auth.refreshToken);

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(401);

    expect(readError(reuse).error).toMatchObject({
      code: 'TOKEN_REUSE_DETECTED',
    });
    const sessions = [...fakePrisma.sessions.values()];
    expect(sessions).toHaveLength(2);
    expect(
      sessions.filter((session) => session.revokedAt !== null),
    ).toHaveLength(1);
  });

  it('logs out and revokes the session', async () => {
    const { auth } = await registerAndLogin('frank@example.com');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(401);

    expect(readError(me).error.code).toBe('UNAUTHORIZED');
  });
});
