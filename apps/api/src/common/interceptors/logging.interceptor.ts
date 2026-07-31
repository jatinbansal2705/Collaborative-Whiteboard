import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const requestId = request.id;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const statusCode = request.res?.statusCode ?? 200;
        const durationMs = Date.now() - startedAt;
        this.logger.log(
          `[${requestId}] ${method} ${originalUrl} ${statusCode} ${durationMs}ms`,
        );
      }),
    );
  }
}
