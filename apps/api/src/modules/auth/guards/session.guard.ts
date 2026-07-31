import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { unauthorized } from '../auth.errors';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (user === undefined) {
      throw unauthorized();
    }

    const session = await this.sessionRepository.findById(user.sessionId);
    const now = new Date();
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt <= now
    ) {
      throw unauthorized('Session is no longer active');
    }

    return true;
  }
}
