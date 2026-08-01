import type { Request, Response } from 'express';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_MS } from '../auth.constants';

export interface OAuthStateCookieOptions {
  secure: boolean;
}

export function setOAuthStateCookie(
  response: Response,
  nonce: string,
  options: OAuthStateCookieOptions,
): void {
  response.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: '/',
  });
}

export function readOAuthStateCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) {
    return undefined;
  }
  const token = `${OAUTH_STATE_COOKIE}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(token)) {
      const value = trimmed.slice(token.length);
      return decodeURIComponent(value);
    }
  }
  return undefined;
}
