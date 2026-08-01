import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SWAGGER_PATH } from '../../config/constants';
import type { ApiSuccessResponse } from '../types/api-response.type';

const EXCLUDED_PATHS = [
  `/${SWAGGER_PATH}`,
  `/${SWAGGER_PATH}-json`,
  `/${SWAGGER_PATH}-yaml`,
];

function isStream(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { pipe?: unknown }).pipe === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPreWrapped(value: unknown): boolean {
  return isRecord(value) && 'data' in value && 'meta' in value;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T | null> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T | null> | T> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (EXCLUDED_PATHS.includes(request.path)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) {
          return { success: true, data: null };
        }
        if (isStream(data)) {
          return data;
        }
        if (isPreWrapped(data)) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
