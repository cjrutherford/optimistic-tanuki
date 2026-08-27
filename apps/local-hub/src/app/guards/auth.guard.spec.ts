import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { AuthStateService } from '../services/auth-state.service';

describe('AuthGuard', () => {
  const isAuthenticated$ = new BehaviorSubject(false);
  const router = { navigate: jest.fn() };

  const configure = (platformId: 'browser' | 'server') => {
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: Router, useValue: router },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated$,
            waitForSessionRestore: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });
  };

  beforeEach(() => {
    isAuthenticated$.next(false);
    jest.clearAllMocks();
  });

  it('allows SSR after the Express gateway session gate has authorized the request', async () => {
    configure('server');

    await expect(TestBed.inject(AuthGuard).canActivate()).resolves.toBe(true);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps browser navigation protected when no client session is restored', async () => {
    configure('browser');

    await expect(TestBed.inject(AuthGuard).canActivate()).resolves.toBe(false);

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('waits for cookie session restoration before deciding browser navigation', async () => {
    let resolveRestore!: () => void;
    const restore = new Promise<void>((resolve) => (resolveRestore = resolve));
    const authState = {
      isAuthenticated$,
      waitForSessionRestore: jest.fn(() => restore),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
      ],
    });
    isAuthenticated$.next(true);

    let settled = false;
    const result = TestBed.inject(AuthGuard)
      .canActivate()
      .then((value) => {
        settled = true;
        return value;
      });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveRestore();
    await expect(result).resolves.toBe(true);
    expect(authState.waitForSessionRestore).toHaveBeenCalledTimes(1);
  });

  it('redirects when browser session restoration rejects', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: router },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated$,
            waitForSessionRestore: jest.fn(() =>
              Promise.reject(new Error('session unavailable'))
            ),
          },
        },
      ],
    });

    await expect(TestBed.inject(AuthGuard).canActivate()).resolves.toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
