import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from 'rxjs';
import {
  REQUEST_TIMEOUT_METADATA,
  RequestTimeoutValue,
} from '../decorators/request-timeout.decorator';

/**
 * Default gateway request timeout (ms) applied when neither the
 * GATEWAY_REQUEST_TIMEOUT_MS env var nor a route-level override is set.
 */
export const DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Resolve the default request timeout from the environment, falling back to
 * {@link DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS}. A non-positive or non-numeric
 * value disables the default timeout (routes then only time out when they
 * carry an explicit override).
 */
export const resolveDefaultTimeoutMs = (): number => {
  const raw = process.env.GATEWAY_REQUEST_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GATEWAY_REQUEST_TIMEOUT_MS;
  }
  // A non-positive configured value explicitly disables the default timeout.
  return parsed;
};

/**
 * Applies a uniform RxJS timeout to every HTTP request handled by the gateway
 * so that a single slow or hung upstream microservice cannot hang a request
 * indefinitely. NestJS' TCP transport has no request-timeout option, so the
 * timeout is enforced here on the returned observable.
 *
 * The interceptor only guards the HTTP context. WebSocket gateway handlers and
 * raw RPC calls (which may legitimately stream or run long) are passed through
 * untouched. Individual routes can opt out or extend the window with the
 * {@link RequestTimeout} / {@link LongRunning} decorators.
 */
@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimeoutInterceptor.name);
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly reflector: Reflector,
    // @Optional() so Nest's DI injects `undefined` (and we fall back to the
    // env-resolved default) instead of trying to resolve a `Number` provider —
    // which crashes app bootstrap when registered via APP_INTERCEPTOR useClass.
    // The parameter remains for direct construction in unit tests.
    @Optional() defaultTimeoutMs?: number
  ) {
    this.defaultTimeoutMs = defaultTimeoutMs ?? resolveDefaultTimeoutMs();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only guard HTTP requests. WebSocket/RPC contexts may stream or run long
    // and are outside the request/response lifecycle a timeout models.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const override = this.reflector.getAllAndOverride<
      RequestTimeoutValue | undefined
    >(REQUEST_TIMEOUT_METADATA, [context.getHandler(), context.getClass()]);

    const timeoutMs =
      override === undefined
        ? this.defaultTimeoutMs
        : override === 'none'
        ? 0
        : override;

    // A non-positive timeout means "no gateway timeout" for this route.
    if (!(timeoutMs > 0)) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(() => this.toTimeoutException(context, timeoutMs));
        }
        return throwError(() => error);
      })
    );
  }

  private toTimeoutException(
    context: ExecutionContext,
    timeoutMs: number
  ): RequestTimeoutException {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const method = request?.method ?? 'UNKNOWN';
    const path = request?.originalUrl ?? request?.url ?? 'unknown';
    // Best-effort upstream identity: the controller handling the route maps to
    // a gateway service proxy. We cannot know the exact TCP target here.
    const target = `${context.getClass().name}.${context.getHandler().name}`;

    this.logger.warn(
      `Gateway request timed out after ${timeoutMs}ms: ${method} ${path} -> ${target}`
    );

    return new RequestTimeoutException({
      statusCode: 408,
      error: 'Request Timeout',
      message: `Upstream service did not respond within ${timeoutMs}ms`,
      method,
      path,
    });
  }
}
