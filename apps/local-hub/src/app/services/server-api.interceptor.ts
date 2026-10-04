import { isPlatformServer } from '@angular/common';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

/**
 * During server rendering, sends relative `/api/...` requests straight to
 * the gateway (the server's API_BASE_URL). Without it, Angular resolves them
 * against the page's own address, so the server would call its public URL
 * (or, in a container, a port it doesn't listen on) to reach its own proxy.
 * Generated clients such as the Daylight one always use relative URLs.
 * In the browser it does nothing.
 */
export const serverApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) return next(request);
  const path = request.url.trim();
  if (!path.startsWith('/api/')) return next(request);
  const base = inject(API_BASE_URL).replace(/\/$/u, '');
  if (!/^https?:\/\//u.test(base)) return next(request);
  return next(request.clone({ url: `${base}${path.slice('/api'.length)}` }));
};
