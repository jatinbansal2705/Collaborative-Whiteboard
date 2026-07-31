import type { LogLevel } from '@nestjs/common';

const LEVEL_MAP: Record<string, LogLevel[]> = {
  silent: [],
  fatal: ['fatal'],
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  info: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
  trace: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
};

export function getLogLevels(level: string): LogLevel[] {
  return LEVEL_MAP[level] ?? LEVEL_MAP['info'];
}
