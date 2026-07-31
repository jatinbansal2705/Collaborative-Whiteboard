import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import type { ApiErrorResponse } from '../types/api-response.type';

interface ResolvedError {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
};

const DEFAULT_STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Route not found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method not allowed',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload too large',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [HttpStatus.BAD_GATEWAY]: 'Bad gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway timeout',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolveError(exception);

    const body: ApiErrorResponse = {
      success: false,
      data: null,
      error: {
        code: resolved.code,
        message: resolved.message,
        details: resolved.details,
      },
    };

    const detailSummary =
      resolved.details !== null && resolved.details !== undefined
        ? ` ${JSON.stringify(resolved.details)}`
        : '';
    this.logger.error(
      `[${request.id}] ${request.method} ${request.originalUrl} -> ${resolved.statusCode} ${resolved.code}${detailSummary}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(resolved.statusCode).json(body);
  }

  private resolveError(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }
    return this.resolveUnknownError(exception);
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let code = STATUS_CODE_MAP[statusCode] ?? `HTTP_${statusCode}`;
    let message =
      DEFAULT_STATUS_MESSAGES[statusCode] ??
      'The request could not be processed';
    let details: unknown = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (isRecord(exceptionResponse)) {
      const raw = exceptionResponse;

      if (Array.isArray(raw['message'])) {
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = raw['message'];
      } else if (typeof raw['message'] === 'string') {
        message = raw['message'];
      }

      if (typeof raw['code'] === 'string') {
        code = raw['code'];
      }

      const extraDetails = Object.fromEntries(
        Object.entries(raw).filter(
          ([key]) => !['statusCode', 'error', 'message', 'code'].includes(key),
        ),
      );
      if (Object.keys(extraDetails).length > 0) {
        details = extraDetails;
      }
    }

    return { statusCode, code, message, details };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ResolvedError {
    const isProduction = this.isProduction();
    const details = isProduction ? null : exception.message;

    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with the same unique value already exists',
          details,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'The operation violates a related record constraint',
          details,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
          details,
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
          details,
        };
    }
  }

  private resolveUnknownError(exception: unknown): ResolvedError {
    const isProduction = this.isProduction();
    const message =
      exception instanceof Error && !isProduction
        ? exception.message
        : 'Internal server error';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message,
      details: null,
    };
  }

  private isProduction(): boolean {
    return this.configService.get<string>('app.env') === 'production';
  }
}
