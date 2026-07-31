import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { UserRole } from '../../generated/prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const getIsPublic = (
  reflector: Reflector,
  context: ExecutionContext,
): boolean =>
  reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) ?? false;

export const getRequiredRoles = (
  reflector: Reflector,
  context: ExecutionContext,
): UserRole[] =>
  reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) ?? [];
