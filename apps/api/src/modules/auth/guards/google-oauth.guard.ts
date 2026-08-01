import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { googleOauthNotConfigured } from '../auth.errors';
import { registerGoogleStrategy } from '../google/google.strategy';
import { setOAuthStateCookie } from '../google/oauth-state-cookie';

@Injectable()
export class GoogleOAuthGuard
  extends AuthGuard('google')
  implements CanActivate
{
  private readonly configured: boolean;
  private readonly secureCookie: boolean;

  constructor(configService: ConfigService) {
    super();
    registerGoogleStrategy(configService);
    this.configured =
      configService.get<string>('google.clientId') !== undefined &&
      configService.get<string>('google.clientSecret') !== undefined &&
      configService.get<string>('google.callbackUrl') !== undefined;
    this.secureCookie = configService.get<string>('app.env') === 'production';
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.configured) {
      throw googleOauthNotConfigured();
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  override getAuthenticateOptions(
    _context: ExecutionContext,
  ): IAuthModuleOptions {
    const response = _context.switchToHttp().getResponse<Response>();
    const nonce = randomBytes(24).toString('hex');
    setOAuthStateCookie(response, nonce, { secure: this.secureCookie });
    return { session: false, state: nonce };
  }
}
