import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';

describe('AuthStateService', () => {
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
});
