import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { BusinessAuthService } from './business-auth.service';

describe('BusinessAuthService', () => {
  let service: BusinessAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        BusinessAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('exchanges owner login tokens into the business-site app scope', () => {
    let storedToken: string | null = null;

    service
      .loginAndExchange('owner@example.com', 'secret')
      .subscribe((user) => {
        storedToken = user.token;
      });

    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.body).toEqual({
      email: 'owner@example.com',
      password: 'secret',
    });
    expect(loginRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    loginRequest.flush({ token: 'base-token', email: 'owner@example.com' });

    const exchangeRequest = httpMock.expectOne('/api/authentication/exchange');
    expect(exchangeRequest.request.body).toEqual({
      targetAppId: 'business-site',
    });
    expect(exchangeRequest.request.headers.get('Authorization')).toBe(
      'Bearer base-token'
    );
    exchangeRequest.flush({ token: 'business-token', profileId: 'profile-1' });

    expect(storedToken).toBe('base-token');
    expect(localStorage.getItem('business-site:token')).toBe('business-token');
  });

  it('registers client accounts in the business-site app scope', () => {
    service
      .registerClient({
        fn: 'Casey',
        ln: 'Client',
        email: 'client@example.com',
        password: 'supersecret',
        confirm: 'supersecret',
        bio: 'Looking for structured support.',
      })
      .subscribe();

    const registerRequest = httpMock.expectOne('/api/authentication/register');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(registerRequest.request.body).toEqual({
      fn: 'Casey',
      ln: 'Client',
      email: 'client@example.com',
      password: 'supersecret',
      confirm: 'supersecret',
      bio: 'Looking for structured support.',
    });
    registerRequest.flush({ ok: true });
  });

  it('persists the client userId from the login response when token claims do not include it', () => {
    let clientUserId = '';

    service.loginClient('client@example.com', 'secret').subscribe((user) => {
      clientUserId = user.userId;
    });

    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.body).toEqual({
      email: 'client@example.com',
      password: 'secret',
    });
    loginRequest.flush({
      token: 'base-token-without-user-claims',
      userId: 'client-user-1',
      email: 'client@example.com',
    });

    const exchangeRequest = httpMock.expectOne('/api/authentication/exchange');
    expect(exchangeRequest.request.body).toEqual({
      targetAppId: 'business-site',
    });
    exchangeRequest.flush({
      token: 'business-token',
      profileId: 'client-profile-1',
    });

    expect(clientUserId).toBe('client-user-1');
    expect(localStorage.getItem('business-site:client-user')).toContain(
      'client-user-1'
    );
  });
});
