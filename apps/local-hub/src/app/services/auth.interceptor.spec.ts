import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor and AuthStateService', () => {
  it('allows the initial cookie session request to restore browser auth', async () => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        AuthenticationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: Router, useValue: { navigate: jest.fn() } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const httpMock = TestBed.inject(HttpTestingController);
    const authState = TestBed.inject(AuthStateService);
    const restored = authState.waitForSessionRestore();
    const request = httpMock.expectOne('/api/authentication/session');

    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-ot-session-mode')).toBe('cookie');
    request.flush({
      data: {
        user: {
          userId: 'user-1',
          name: 'Member',
          email: 'member@example.com',
        },
      },
    });

    await expect(restored).resolves.toBeUndefined();
    expect(authState.isAuthenticated).toBe(true);
    httpMock.verify();
  });
});
