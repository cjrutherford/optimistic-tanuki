import {
  HttpErrorResponse,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { AuthStateService } from './state/auth-state.service';
import { AuthInterceptor } from './http.interceptor';
import { errorInterceptor } from './http.error-interceptor';

describe('client HTTP interceptors', () => {
  const authState = {
    getToken: jest.fn(() => null),
    logout: jest.fn(),
  };
  const router = { navigate: jest.fn() };
  const messages = { addMessage: jest.fn() };
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: messages },
      ],
    });
  });

  afterEach(() => consoleError.mockRestore());

  describe('AuthInterceptor', () => {
    const runAuth = (
      url: string,
      next: Parameters<typeof AuthInterceptor>[1]
    ) =>
      TestBed.runInInjectionContext(() =>
        AuthInterceptor(new HttpRequest('GET', url), next)
      );

    it.each([
      ['/api/social/feed', 'social'],
      ['/api/blog/posts', 'blogging'],
      ['/api/project/tasks', 'project-planning'],
      ['/api/profile/1', 'client-interface'],
    ])('tags %s with the %s app scope', (url, scope) => {
      let seen: HttpRequest<unknown> | undefined;
      runAuth(url, (req) => {
        seen = req;
        return of(new HttpResponse({ status: 200 }));
      }).subscribe();

      expect(seen?.headers.get('X-ot-appscope')).toBe(scope);
      expect(seen?.headers.get('X-ot-session-mode')).toBe('cookie');
      expect(seen?.withCredentials).toBe(true);
    });

    it('does not log out when a cookie-session check is unauthenticated', () => {
      runAuth('/api/authentication/session', () =>
        throwError(() => new HttpErrorResponse({ status: 401 }))
      ).subscribe({ error: () => undefined });

      expect(authState.logout).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('logs out and redirects on a 401 from a protected endpoint', () => {
      runAuth('/api/social/feed', () =>
        throwError(() => new HttpErrorResponse({ status: 401 }))
      ).subscribe({ error: () => undefined });

      expect(authState.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('does not log out on a 403', () => {
      runAuth('/api/social/feed', () =>
        throwError(() => new HttpErrorResponse({ status: 403 }))
      ).subscribe({ error: () => undefined });

      expect(authState.logout).not.toHaveBeenCalled();
    });

    it('re-throws the original error', (done) => {
      const original = new HttpErrorResponse({ status: 500 });
      runAuth('/api/social/feed', () => throwError(() => original)).subscribe({
        error: (err) => {
          expect(err).toBe(original);
          done();
        },
      });
    });
  });

  describe('errorInterceptor', () => {
    const runError = (
      url: string,
      error: HttpErrorResponse,
      handled: (err: unknown) => void = () => undefined
    ) =>
      TestBed.runInInjectionContext(() =>
        errorInterceptor(new HttpRequest('GET', url), () =>
          throwError(() => error)
        )
      ).subscribe({ error: handled });

    const lastMessage = () =>
      messages.addMessage.mock.calls[
        messages.addMessage.mock.calls.length - 1
      ][0];

    it('passes successful responses through untouched', (done) => {
      TestBed.runInInjectionContext(() =>
        errorInterceptor(new HttpRequest('GET', '/api/social/feed'), () =>
          of(new HttpResponse({ status: 200, body: { ok: true } }))
        )
      ).subscribe((res) => {
        expect((res as HttpResponse<unknown>).body).toEqual({ ok: true });
        expect(messages.addMessage).not.toHaveBeenCalled();
        done();
      });
    });

    it('does not show a session-expired message for an unauthenticated response', () => {
      runError(
        '/api/authentication/session',
        new HttpErrorResponse({ status: 401 })
      );

      expect(messages.addMessage).not.toHaveBeenCalled();
    });

    it('re-throws the original error', (done) => {
      const original = new HttpErrorResponse({ status: 500 });
      runError('/api/social/feed', original, (err) => {
        expect(err).toBe(original);
        done();
      });
    });

    it('shows a session-expired message for a 401 from a protected endpoint', () => {
      runError('/api/social/feed', new HttpErrorResponse({ status: 401 }));

      expect(messages.addMessage).toHaveBeenCalledWith({
        content: 'Your session has expired. Please log in again.',
        type: 'warning',
      });
    });

    it('reports a connection problem for status 0', () => {
      runError('/api/social/feed', new HttpErrorResponse({ status: 0 }));

      expect(lastMessage()).toEqual({
        content:
          'Unable to connect to server. Please check your internet connection.',
        type: 'warning',
      });
    });

    it('surfaces the client message for an ErrorEvent', () => {
      runError(
        '/api/social/feed',
        new HttpErrorResponse({
          status: 0,
          error: new ErrorEvent('net', { message: 'offline' }),
        })
      );

      expect(lastMessage()).toEqual({ content: 'offline', type: 'error' });
    });

    it.each([
      [400, 'Invalid request. Please check your input.', 'warning'],
      [403, 'You do not have permission to perform this action.', 'error'],
      [404, 'The requested resource was not found.', 'info'],
      [409, 'A conflict occurred. Please refresh and try again.', 'warning'],
      [422, 'Validation error. Please check your input.', 'warning'],
      [
        429,
        'Too many requests. Please wait a moment before trying again.',
        'warning',
      ],
      [
        500,
        'Server error. Our team has been notified. Please try again later.',
        'error',
      ],
      [
        502,
        'Service temporarily unavailable. Please try again later.',
        'warning',
      ],
      [
        503,
        'Service temporarily unavailable. Please try again later.',
        'warning',
      ],
      [
        504,
        'Service temporarily unavailable. Please try again later.',
        'warning',
      ],
    ])('maps status %s to its default message', (status, content, type) => {
      runError('/api/social/feed', new HttpErrorResponse({ status }));

      expect(lastMessage()).toEqual({ content, type });
    });

    it.each([400, 404, 409, 422])(
      'prefers the server supplied message for status %s',
      (status) => {
        runError(
          '/api/social/feed',
          new HttpErrorResponse({ status, error: { message: 'from server' } })
        );

        expect(lastMessage().content).toBe('from server');
      }
    );

    it('falls back to the status code for an unmapped status', () => {
      runError('/api/social/feed', new HttpErrorResponse({ status: 418 }));

      expect(lastMessage()).toEqual({ content: 'Error: 418', type: 'error' });
    });

    it('uses the server message for an unmapped status when present', () => {
      runError(
        '/api/social/feed',
        new HttpErrorResponse({ status: 418, error: { message: 'teapot' } })
      );

      expect(lastMessage().content).toBe('teapot');
    });

    it('logs the failure with request context', () => {
      runError('/api/social/feed', new HttpErrorResponse({ status: 500 }));

      expect(consoleError).toHaveBeenCalledWith(
        'HTTP Error:',
        expect.objectContaining({ status: 500, url: '/api/social/feed' })
      );
    });
  });
});
