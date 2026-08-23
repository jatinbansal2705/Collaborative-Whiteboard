import type { LogLevel, LoggerService } from '@nestjs/common';
import {
  pino,
  type DestinationStream,
  type Logger as PinoLoggerInstance,
  type LoggerOptions,
} from 'pino';
import { SERVICE_NAME } from '../../config/constants';
import { getRequestId } from './request-id.context';

type PinoLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface PinoLoggerOptions {
  /** Raw log level string from config (trace/debug/info/warn/error/fatal). */
  level?: string;
  /** Nest log levels used to decide which methods write (matches LOG_LEVEL). */
  logLevels?: LogLevel[];
  /** Optional writable destination for tests; defaults to stdout. */
  destination?: DestinationStream;
}

const DEFAULT_LEVEL: PinoLevel = 'info';

/**
 * NestJS `LoggerService` backed by pino (ADR: structured JSON logging).
 * Every log line carries `service`, `environment`, and — while a request is
 * in flight — the `requestId` from the AsyncLocalStorage context set by the
 * request-id middleware, so REST and realtime logs are correlated end to end.
 */
export class PinoLogger implements LoggerService {
  private readonly logger: PinoLoggerInstance;
  private readonly enabled: Set<LogLevel>;
  private context?: string;

  constructor(options: PinoLoggerOptions = {}) {
    const level = PinoLogger.resolveLevel(options.level);
    this.enabled = new Set<LogLevel>(options.logLevels);
    const base = PinoLogger.baseOptions(level);
    this.logger =
      options.destination !== undefined
        ? pino(base, options.destination)
        : pino(base);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', 'log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', 'error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', 'warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', 'debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', 'verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', 'fatal', message, optionalParams);
  }

  setContext(context: string): void {
    this.context = context;
  }

  private write(
    method: PinoLevel,
    nestLevel: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (this.enabled.size > 0 && !this.enabled.has(nestLevel)) {
      return;
    }

    const context = this.resolveContext(optionalParams) ?? this.context;
    const bindings: Record<string, string> = context ? { context } : {};

    if (typeof message === 'string') {
      this.emit(method, bindings, message);
      return;
    }
    if (PinoLogger.isRecord(message)) {
      const recordBindings =
        this.context !== undefined ? { context: this.context } : {};
      this.emit(
        method,
        { ...message, ...recordBindings },
        this.resolveMessage(optionalParams),
      );
      return;
    }
    this.emit(method, bindings, String(message));
  }

  private emit(method: PinoLevel, obj: object, msg?: string): void {
    switch (method) {
      case 'fatal':
        this.logger.fatal(obj, msg ?? '');
        return;
      case 'error':
        this.logger.error(obj, msg ?? '');
        return;
      case 'warn':
        this.logger.warn(obj, msg ?? '');
        return;
      case 'debug':
        this.logger.debug(obj, msg ?? '');
        return;
      case 'trace':
        this.logger.trace(obj, msg ?? '');
        return;
      default:
        this.logger.info(obj, msg ?? '');
    }
  }

  private resolveContext(optionalParams: unknown[]): string | undefined {
    for (let i = optionalParams.length - 1; i >= 0; i -= 1) {
      const param = optionalParams[i];
      if (typeof param === 'string' && param.length > 0) {
        return param;
      }
    }
    return undefined;
  }

  private resolveMessage(optionalParams: unknown[]): string | undefined {
    const first = optionalParams[0];
    return typeof first === 'string' ? first : undefined;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static resolveLevel(level: string | undefined): PinoLevel {
    const normalized = level?.trim().toLowerCase();
    switch (normalized) {
      case 'fatal':
      case 'error':
      case 'warn':
      case 'debug':
      case 'trace':
        return normalized;
      case 'silent':
        return 'fatal';
      default:
        return DEFAULT_LEVEL;
    }
  }

  private static baseOptions(level: PinoLevel): LoggerOptions {
    return {
      level,
      base: {
        service: SERVICE_NAME,
        environment: process.env.NODE_ENV ?? 'development',
      },
      formatters: {
        level: (label: string): { level: string } => ({
          level: label,
        }),
      },
      mixin: (): { requestId?: string } => {
        const requestId = getRequestId();
        return requestId !== undefined ? { requestId } : {};
      },
    };
  }
}
