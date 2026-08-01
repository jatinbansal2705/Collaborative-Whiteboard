import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';
import type { Request } from 'express';
import { invalidOauthState } from '../auth.errors';
import { registerGoogleStrategy } from '../google/google.strategy';

@Injectable()
export class GoogleOAuthCallbackGuard
  extends AuthGuard('google')
  implements CanActivate
{
  constructor(configService: ConfigService) {
    super();
    registerGoogleStrategy(configService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.query?.code === undefined) {
      throw invalidOauthState();
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  override getAuthenticateOptions(): IAuthModuleOptions {
    return { session: false };
  }
}
