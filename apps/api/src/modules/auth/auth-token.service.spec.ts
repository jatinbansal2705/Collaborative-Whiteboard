import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { TokenService, type JwtConfig } from './auth-token.service';
import { AUTH_ERROR_CODES } from './auth.errors';

const ACCESS_SECRET = 'test-access-secret-123456';
const REFRESH_SECRET = 'test-refresh-secret-123456';

const jwtConfig: JwtConfig = {
  accessSecret: ACCESS_SECRET,
  accessExpiresIn: '15m',
  refreshSecret: REFRESH_SECRET,
  refreshExpiresIn: '30d',
  issuer: 'collaborative-whiteboard',
  audience: 'whiteboard-api',
};

const tokenOptions = {
  userId: 'user-1',
  email: 'alice@example.com',
  role: 'USER' as const,
  sessionId: 'session-1',
  familyId: 'family-1',
};

describe('TokenService', () => {
  let jwtService: JwtService;
  let service: TokenService;

  beforeEach(() => {
    jwtService = new JwtService();
    service = new TokenService(jwtService, jwtConfig);
  });

  describe('hashRefreshToken', () => {
    it('returns a deterministic sha256 hex digest', () => {
      const hash = service.hashRefreshToken('some-token');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(service.hashRefreshToken('some-token')).toBe(hash);
    });

    it('produces different hashes for different tokens', () => {
      expect(service.hashRefreshToken('token-a')).not.toBe(
        service.hashRefreshToken('token-b'),
      );
    });
  });

  describe('access tokens', () => {
    it('signs and verifies an access token', async () => {
      const token = service.signAccessToken(tokenOptions);
      const verified = await service.verifyAccessToken(token);

      expect(verified).toEqual({
        userId: 'user-1',
        email: 'alice@example.com',
        role: 'USER',
        sessionId: 'session-1',
      });
    });

    it('rejects a token signed with the wrong secret', async () => {
      const token = new JwtService().sign(
        { email: tokenOptions.email, role: 'USER', sid: 'session-1' },
        {
          subject: 'user-1',
          secret: 'wrong-secret',
          expiresIn: '15m' as StringValue,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        },
      );

      await expect(service.verifyAccessToken(token)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN },
      });
    });

    it('rejects an expired access token', async () => {
      const token = jwtService.sign(
        { email: tokenOptions.email, role: 'USER', sid: 'session-1' },
        {
          subject: 'user-1',
          secret: ACCESS_SECRET,
          expiresIn: -10,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        },
      );

      await expect(service.verifyAccessToken(token)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.ACCESS_TOKEN_EXPIRED },
      });
    });

    it('rejects a refresh token presented as an access token', async () => {
      const refreshToken = service.signRefreshToken(tokenOptions);
      await expect(
        service.verifyAccessToken(refreshToken),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN },
      });
    });
  });

  describe('refresh tokens', () => {
    it('signs and verifies a refresh token with family claims', async () => {
      const token = service.signRefreshToken(tokenOptions);
      const verified = await service.verifyRefreshToken(token);

      expect(verified).toEqual({
        userId: 'user-1',
        sessionId: 'session-1',
        familyId: 'family-1',
      });
    });

    it('rejects a token signed with the wrong secret', async () => {
      const token = new JwtService().sign(
        { fam: 'family-1', typ: 'refresh' },
        {
          subject: 'user-1',
          jwtid: 'session-1',
          secret: 'wrong-secret',
          expiresIn: '30d' as StringValue,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        },
      );

      await expect(service.verifyRefreshToken(token)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN },
      });
    });

    it('rejects an expired refresh token', async () => {
      const token = jwtService.sign(
        { fam: 'family-1', typ: 'refresh' },
        {
          subject: 'user-1',
          jwtid: 'session-1',
          secret: REFRESH_SECRET,
          expiresIn: -10,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        },
      );

      await expect(service.verifyRefreshToken(token)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED },
      });
    });

    it('rejects an access token presented as a refresh token', async () => {
      const accessToken = service.signAccessToken(tokenOptions);
      await expect(
        service.verifyRefreshToken(accessToken),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN },
      });
    });
  });
});
