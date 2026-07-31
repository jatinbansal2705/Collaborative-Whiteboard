import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { getIsPublic } from '../../../common/guards/guard-utils';
import { unauthorized } from '../auth.errors';
import { TokenService } from '../auth-token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = getIsPublic(this.reflector, context);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (token === undefined) {
      throw unauthorized('Missing Bearer token');
    }

    const verified = await this.tokenService.verifyAccessToken(token);
    const user: AuthenticatedUser = {
      id: verified.userId,
      email: verified.email,
      role: verified.role,
      sessionId: verified.sessionId,
    };
    request.user = user;

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (authorization === undefined) {
      return undefined;
    }
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || token === undefined) {
      return undefined;
    }
    return token;
  }
}
