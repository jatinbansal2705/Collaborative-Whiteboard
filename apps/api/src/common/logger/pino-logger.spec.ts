import { Writable } from 'node:stream';
import { getLogLevels } from './log-levels';
import { PinoLogger } from './pino-logger';
import { runWithRequestId } from './request-id.context';

class CapturingStream extends Writable {
  readonly lines: string[] = [];

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(chunk.toString());
    callback();
  }
}

function parseLine(lines: string[], index = 0): Record<string, unknown> {
  return JSON.parse(lines[index]) as Record<string, unknown>;
}

describe('PinoLogger', () => {
  let destination: CapturingStream;
  let logger: PinoLogger;

  const createLogger = (level = 'info'): PinoLogger => {
    destination = new CapturingStream();
    return new PinoLogger({
      level,
      logLevels: getLogLevels(level),
      destination,
    });
  };

  it('writes structured JSON to the destination', () => {
    logger = createLogger();
    logger.log('hello world');

    const line = parseLine(destination.lines);
    expect(line).toMatchObject({
      level: 'info',
      msg: 'hello world',
      service: 'collaborative-whiteboard-api',
    });
    expect(line['environment']).toBe(process.env.NODE_ENV ?? 'development');
  });

  it('attaches the context passed as the last argument', () => {
    logger = createLogger();
    logger.log('message', 'HealthController');

    expect(parseLine(destination.lines)).toMatchObject({
      msg: 'message',
      context: 'HealthController',
    });
  });

  it('logs object messages as structured data', () => {
    logger = createLogger();
    logger.warn({ code: 'LIMIT_EXCEEDED', attempts: 3 }, 'Retries exceeded');

    expect(parseLine(destination.lines)).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      attempts: 3,
      msg: 'Retries exceeded',
    });
  });

  it('honours the configured Nest log levels (debug filtered at info)', () => {
    logger = createLogger('info');
    logger.debug('hidden');
    logger.log('visible');

    expect(destination.lines).toHaveLength(1);
    expect(parseLine(destination.lines).msg).toBe('visible');
  });

  it('emits error level lines for fatal', () => {
    logger = createLogger('fatal');
    logger.fatal('boom');

    expect(parseLine(destination.lines).level).toBe('fatal');
  });

  it('correlates request-id from the AsyncLocalStorage context', () => {
    logger = createLogger();

    runWithRequestId('req-123', () => {
      logger.log('in request');
    });

    expect(parseLine(destination.lines)).toMatchObject({
      msg: 'in request',
      requestId: 'req-123',
    });
  });

  it('omits requestId outside a request context', () => {
    logger = createLogger();
    logger.log('background');

    const line = parseLine(destination.lines);
    expect(line['requestId']).toBeUndefined();
  });
});
