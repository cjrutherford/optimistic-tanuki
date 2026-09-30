import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LogBufferService } from './log-buffer.service';

/**
 * Records backend `x-request-id` response headers into the log buffer
 * so bug reports can correlate browser + back-end logs.
 * Register with `provideHttpClient(withInterceptors([bugReportTraceInterceptor]))`.
 */
export function bugReportTraceInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const logs = inject(LogBufferService, { optional: true });
  return next(req).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event.type === 0) return;
      const headers = (
        event as unknown as { headers?: { get: (k: string) => string | null } }
      ).headers;
      const traceId = headers?.get?.('x-request-id');
      if (traceId) logs?.addTraceId(traceId);
    })
  );
}
