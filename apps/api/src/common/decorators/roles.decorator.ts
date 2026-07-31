import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';
import { ROLES_KEY } from '../guards/guard-utils';

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
