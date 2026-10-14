import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';
import * as CommonUi from '@optimistic-tanuki/common-ui';

describe('AuthStateService', () => {
  it('opens RUM only after the server-verified session restore and closes it on logout', async () => {
    const eligibility = jest.spyOn(
      CommonUi,
      'setPerformanceMonitoringEligibility'
    );
    const currentSession = jest.fn().mockResolvedValue({
      data: { userId: 'user-1', name: 'Member', email: 'member@example.test' },
    });
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthenticationService, useValue: { currentSession } },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    await service.waitForSessionRestore();
    expect(eligibility).toHaveBeenCalledWith('local-hub', true);

    service.logout();
    expect(eligibility).toHaveBeenLastCalledWith('local-hub', false);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/authentication/logout')
      .flush({});
    eligibility.mockRestore();
  });

  it('shares the pending browser session restore with all guards', async () => {
    let resolveSession!: (value: unknown) => void;
    const currentSession = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        })
    );

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthenticationService, useValue: { currentSession } },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    const first = service.waitForSessionRestore();
    const second = service.waitForSessionRestore();

    expect(currentSession).toHaveBeenCalledTimes(1);
    resolveSession({
      data: {
        user: {
          userId: 'user-1',
          name: 'Member',
          email: 'member@example.com',
        },
      },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(service.isAuthenticated).toBe(true);
  });

  it('keeps the newest restore result when an older request finishes later', async () => {
    let rejectInitial!: (reason: unknown) => void;
    let resolveNewest!: (value: unknown) => void;
    const currentSession = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectInitial = reject;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewest = resolve;
          })
      );

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthenticationService, useValue: { currentSession } },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    const newestRestore = service.restoreSession();
    resolveNewest({
      data: {
        userId: 'user-2',
        name: 'New Member',
        email: 'new@example.com',
      },
    });
    await newestRestore;

    rejectInitial(new Error('stale session failure'));
    await service.waitForSessionRestore();

    expect(service.isAuthenticated).toBe(true);
    expect(service.getUserData()?.userId).toBe('user-2');
  });

  it('does not restore a signed-out user from a late session response', async () => {
    let resolve!: (value: unknown) => void;
    const currentSession = jest.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthenticationService, useValue: { currentSession } },
      ],
    });
    const service = TestBed.inject(AuthStateService);
    const pending = service.waitForSessionRestore();
    service.logout();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/authentication/logout')
      .flush({});
    resolve({ data: { userId: 'old-user', email: 'old@example.test' } });
    await pending;
    expect(service.isAuthenticated).toBe(false);
    expect(service.getUserData()).toBeNull();
  });

  it('rejects login when the session cannot be restored', async () => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: AuthenticationService,
          useValue: {
            login: jest.fn().mockResolvedValue({}),
            currentSession: jest
              .fn()
              .mockRejectedValue(new Error('no session')),
          },
        },
      ],
    });
    const service = TestBed.inject(AuthStateService);
    await service.waitForSessionRestore();
    await expect(
      service.login({ email: 'user@example.test', password: 'test-password' })
    ).rejects.toThrow();
  });
  describe('server platform', () => {
    function setupServer(currentSession = jest.fn()) {
      TestBed.configureTestingModule({
        providers: [
          AuthStateService,
          provideHttpClient(),
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: AuthenticationService, useValue: { currentSession } },
          { provide: API_BASE_URL, useValue: '/api' },
        ],
      });
      return TestBed.inject(AuthStateService);
    }

    it('never restores a session or reports authenticated on the server', async () => {
      const currentSession = jest.fn();
      const service = setupServer(currentSession);

      expect(service.isAuthenticated).toBe(false);
      expect(service.getToken()).toBeNull();

      await service.restoreSession();
      await service.waitForSessionRestore();

      expect(currentSession).not.toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(false);
    });

    it('no-ops logout on the server', () => {
      const service = setupServer();
      expect(() => service.logout()).not.toThrow();
      expect(service.isAuthenticated).toBe(false);
    });
  });

  describe('browser platform behaviors', () => {
    it('exposes null token, and derives acting profile id with fallbacks', async () => {
      const currentSession = jest.fn().mockResolvedValue({
        data: { userId: 'user-3', name: 'Three', email: 'three@example.com' },
      });

      TestBed.configureTestingModule({
        providers: [
          AuthStateService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: AuthenticationService, useValue: { currentSession } },
          { provide: API_BASE_URL, useValue: '/api' },
        ],
      });

      const service = TestBed.inject(AuthStateService);
      await service.waitForSessionRestore();

      expect(service.getToken()).toBeNull();
      // profileId is absent on this user, so it falls back to userId.
      expect(service.getActingProfileId()).toBe('user-3');
    });

    it('falls back to an empty string when there is no user data at all', async () => {
      const currentSession = jest
        .fn()
        .mockRejectedValue(new Error('no session'));

      TestBed.configureTestingModule({
        providers: [
          AuthStateService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: AuthenticationService, useValue: { currentSession } },
          { provide: API_BASE_URL, useValue: '/api' },
        ],
      });

      const service = TestBed.inject(AuthStateService);
      await service.waitForSessionRestore();

      expect(service.isAuthenticated).toBe(false);
      expect(service.getActingProfileId()).toBe('');
    });

    it('logs in by delegating to AuthenticationService then restoring the session', async () => {
      const login = jest.fn().mockResolvedValue(undefined);
      const currentSession = jest
        .fn()
        .mockResolvedValueOnce({
          data: { userId: 'anon', name: '', email: '' },
        })
        .mockResolvedValueOnce({
          data: { userId: 'user-4', name: 'Four', email: 'four@example.com' },
        });

      TestBed.configureTestingModule({
        providers: [
          AuthStateService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: AuthenticationService,
            useValue: { login, currentSession },
          },
          { provide: API_BASE_URL, useValue: '/api' },
        ],
      });

      const service = TestBed.inject(AuthStateService);
      await service.waitForSessionRestore();

      await service.login({ email: 'four@example.com', password: 'secret' });

      expect(login).toHaveBeenCalledWith({
        email: 'four@example.com',
        password: 'secret',
      });
      expect(service.getUserData()?.userId).toBe('user-4');
    });

    it('clears auth state and posts to the logout endpoint', async () => {
      const currentSession = jest.fn().mockResolvedValue({
        data: { userId: 'user-5', name: 'Five', email: 'five@example.com' },
      });

      TestBed.configureTestingModule({
        providers: [
          AuthStateService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: AuthenticationService, useValue: { currentSession } },
          { provide: API_BASE_URL, useValue: '/api' },
        ],
      });

      const service = TestBed.inject(AuthStateService);
      await service.waitForSessionRestore();
      expect(service.isAuthenticated).toBe(true);

      const httpMock = TestBed.inject(HttpTestingController);
      service.logout();

      const req = httpMock.expectOne('/api/authentication/logout');
      expect(req.request.method).toBe('POST');
      req.flush({});

      expect(service.isAuthenticated).toBe(false);
      expect(service.getUserData()).toBeNull();
      httpMock.verify();
    });
  });
});
