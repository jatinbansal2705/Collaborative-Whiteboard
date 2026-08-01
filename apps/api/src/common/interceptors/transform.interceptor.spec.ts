import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const createExecutionContext = (path: string): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ path }) }),
    }) as unknown as ExecutionContext;

  const createCallHandler = (value: unknown): CallHandler => ({
    handle: () => of(value),
  });

  it('wraps successful payloads in the api envelope', async () => {
    const interceptor = new TransformInterceptor();

    const result = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext('/api/v1'),
        createCallHandler({ ok: true }),
      ),
    );

    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it('wraps null and undefined payloads as null data', async () => {
    const interceptor = new TransformInterceptor();

    const nullResult = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext('/api/v1'),
        createCallHandler(null),
      ),
    );
    const undefinedResult = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext('/api/v1'),
        createCallHandler(undefined),
      ),
    );

    expect(nullResult).toEqual({ success: true, data: null });
    expect(undefinedResult).toEqual({ success: true, data: null });
  });

  it('does not wrap swagger routes', async () => {
    const interceptor = new TransformInterceptor();

    const result = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext('/docs'),
        createCallHandler('<html>swagger ui</html>'),
      ),
    );

    expect(result).toBe('<html>swagger ui</html>');
  });

  it('passes pre-wrapped payloads with meta through untouched', async () => {
    const interceptor = new TransformInterceptor();

    const result = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext('/api/v1'),
        createCallHandler({ data: [{ id: '1' }], meta: { hasNextPage: true } }),
      ),
    );

    expect(result).toEqual({
      data: [{ id: '1' }],
      meta: { hasNextPage: true },
    });
  });

  it('passes non-http contexts through untouched', async () => {
    const interceptor = new TransformInterceptor();
    const nonHttpContext = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;

    const result = await lastValueFrom(
      interceptor.intercept(nonHttpContext, createCallHandler('payload')),
    );

    expect(result).toBe('payload');
  });
});
