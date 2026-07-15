import {
  CallHandler,
  ExecutionContext,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError, timer } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS,
  RequestTimeoutInterceptor,
  resolveDefaultTimeoutMs,
} from './request-timeout.interceptor';
import { REQUEST_TIMEOUT_METADATA } from '../decorators/request-timeout.decorator';

class TestController {}
function handler() {
  /* route handler placeholder */
}

const createContext = (
  type: 'http' | 'ws' | 'rpc' = 'http',
  request: Record<string, unknown> = { method: 'GET', url: '/api/test' }
): ExecutionContext =>
  ({
    getType: () => type,
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext);

const callHandler = (source: unknown): CallHandler =>
  ({
    handle: () => source,
  } as unknown as CallHandler);

describe('RequestTimeoutInterceptor', () => {
  const reflector = new Reflector();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes through a fast observable within the timeout window', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 100);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result$ = interceptor.intercept(
      createContext(),
      callHandler(of('ok'))
    );

    await expect(firstValueFrom(result$)).resolves.toBe('ok');
  });

  it('throws RequestTimeoutException when the observable exceeds the timeout', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 20);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const slow$ = timer(200).pipe(map(() => 'too-late'));
    const result$ = interceptor.intercept(createContext(), callHandler(slow$));

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(
      RequestTimeoutException
    );
  });

  it('surfaces a structured 408 payload with method and path', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 20);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const slow$ = timer(200).pipe(map(() => 'too-late'));
    const result$ = interceptor.intercept(
      createContext('http', { method: 'POST', originalUrl: '/api/slow' }),
      callHandler(slow$)
    );

    await expect(firstValueFrom(result$)).rejects.toMatchObject({
      response: {
        statusCode: 408,
        error: 'Request Timeout',
        method: 'POST',
        path: '/api/slow',
      },
    });
  });

  it('honours a longer route-level override', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 20);
    // Override to 500ms so a 100ms observable completes.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(500);

    const source$ = of('ok').pipe(delay(100));
    const result$ = interceptor.intercept(
      createContext(),
      callHandler(source$)
    );

    await expect(firstValueFrom(result$)).resolves.toBe('ok');
  });

  it("disables the timeout when the route override is 'none'", async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 10);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('none');

    // Slower than the default, but the route opted out entirely.
    const source$ = of('ok').pipe(delay(60));
    const result$ = interceptor.intercept(
      createContext(),
      callHandler(source$)
    );

    await expect(firstValueFrom(result$)).resolves.toBe('ok');
  });

  it('reads the metadata key from the handler and class', () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 100);
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);

    firstValueFrom(
      interceptor.intercept(createContext(), callHandler(of('ok')))
    );

    expect(spy).toHaveBeenCalledWith(REQUEST_TIMEOUT_METADATA, [
      handler,
      TestController,
    ]);
  });

  it('does not apply a timeout to non-HTTP (WebSocket/RPC) contexts', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 10);
    const spy = jest.spyOn(reflector, 'getAllAndOverride');

    const slow$ = of('streamed').pipe(delay(50));
    const result$ = interceptor.intercept(
      createContext('ws'),
      callHandler(slow$)
    );

    await expect(firstValueFrom(result$)).resolves.toBe('streamed');
    // Metadata is never consulted for non-HTTP contexts.
    expect(spy).not.toHaveBeenCalled();
  });

  it('re-throws non-timeout errors unchanged', async () => {
    const interceptor = new RequestTimeoutInterceptor(reflector, 100);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const boom = new Error('upstream exploded');
    const result$ = interceptor.intercept(
      createContext(),
      callHandler(throwError(() => boom))
    );

    await expect(firstValueFrom(result$)).rejects.toBe(boom);
  });
});

describe('resolveDefaultTimeoutMs', () => {
  const original = process.env.GATEWAY_REQUEST_TIMEOUT_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GATEWAY_REQUEST_TIMEOUT_MS;
    } else {
      process.env.GATEWAY_REQUEST_TIMEOUT_MS = original;
    }
  });

  it('falls back to the default when unset', () => {
    delete process.env.GATEWAY_REQUEST_TIMEOUT_MS;
    expect(resolveDefaultTimeoutMs()).toBe(DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS);
  });

  it('reads a positive numeric override from the environment', () => {
    process.env.GATEWAY_REQUEST_TIMEOUT_MS = '5000';
    expect(resolveDefaultTimeoutMs()).toBe(5000);
  });

  it('falls back to the default for a non-numeric value', () => {
    process.env.GATEWAY_REQUEST_TIMEOUT_MS = 'not-a-number';
    expect(resolveDefaultTimeoutMs()).toBe(DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS);
  });
});
