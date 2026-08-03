import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
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

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: messages },
      ],
    });
  });

  it('does not log out when a cookie-session check is unauthenticated', () => {
    TestBed.runInInjectionContext(() =>
      AuthInterceptor(
        new HttpRequest('GET', '/api/authentication/session'),
        () => throwError(() => new HttpErrorResponse({ status: 401 }))
      )
    ).subscribe({ error: () => undefined });

    expect(authState.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not show a session-expired message for an unauthenticated response', () => {
    TestBed.runInInjectionContext(() =>
      errorInterceptor(
        new HttpRequest('GET', '/api/authentication/session'),
        () => throwError(() => new HttpErrorResponse({ status: 401 }))
      )
    ).subscribe({ error: () => undefined });

    expect(messages.addMessage).not.toHaveBeenCalled();
  });
});
