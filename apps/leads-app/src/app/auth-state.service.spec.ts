import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';
import type { ProfileDto } from '@optimistic-tanuki/ui-models';

describe('AuthStateService', () => {
  let auth: {
    login: jest.Mock;
    currentSession: jest.Mock;
    logout: jest.Mock;
  };

  const profile = (id = 'prof-1') => ({ id, name: 'Ada' } as ProfileDto);

  const build = (platform: 'browser' | 'server' = 'browser') => {
    TestBed.resetTestingModule();
    auth = {
      login: jest.fn().mockResolvedValue({ data: {} }),
      currentSession: jest
        .fn()
        .mockResolvedValue({ data: { userId: 'user-1', name: 'Ada' } }),
      logout: jest.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: AuthenticationService, useValue: auth },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    return TestBed.inject(AuthStateService);
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('in the browser', () => {
    it('restores the session on construction', async () => {
      const service = build();
      await Promise.resolve();

      expect(auth.currentSession).toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toMatchObject({
        userId: 'user-1',
      });
    });

    it('clears auth state when the session cannot be restored', async () => {
      const service = build();
      auth.currentSession.mockRejectedValue(new Error('401'));

      await service.restoreSession();

      expect(service.isAuthenticated).toBe(false);
      expect(service.getDecodedTokenValue()).toBeNull();
    });

    it('logs in then restores the session', async () => {
      const service = build();
      auth.currentSession.mockClear();

      const result = await service.login({
        email: 'ada@example.com',
        password: 'pw',
      } as never);

      expect(auth.login).toHaveBeenCalled();
      expect(auth.currentSession).toHaveBeenCalled();
      expect(result).toEqual({ data: {} });
    });

    it('clears stored profiles and state on logout', async () => {
      const service = build();
      await Promise.resolve();
      service.persistProfiles([profile()]);
      service.persistSelectedProfile(profile());

      service.logout();

      expect(auth.logout).toHaveBeenCalled();
      expect(service.getPersistedProfiles()).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();
      expect(service.isAuthenticated).toBe(false);
    });

    it('swallows a failing logout request', () => {
      const service = build();
      auth.logout.mockReturnValue(throwError(() => new Error('network')));

      expect(() => service.logout()).not.toThrow();
      expect(service.isAuthenticated).toBe(false);
    });

    it('round-trips persisted profiles', () => {
      const service = build();

      service.persistProfiles([profile('a'), profile('b')]);

      expect(service.getPersistedProfiles()).toEqual([
        profile('a'),
        profile('b'),
      ]);
    });

    it('removes persisted profiles when given null', () => {
      const service = build();
      service.persistProfiles([profile()]);

      service.persistProfiles(null);

      expect(service.getPersistedProfiles()).toBeNull();
    });

    it('round-trips the selected profile and publishes it', (done) => {
      const service = build();
      service.persistSelectedProfile(profile('selected'));

      expect(service.getPersistedSelectedProfile()).toEqual(
        profile('selected')
      );
      service.currentProfile$.subscribe((value) => {
        expect(value).toEqual(profile('selected'));
        done();
      });
    });

    it('clears the selected profile when given null', (done) => {
      const service = build();
      service.persistSelectedProfile(profile());

      service.persistSelectedProfile(null);

      expect(service.getPersistedSelectedProfile()).toBeNull();
      service.currentProfile$.subscribe((value) => {
        expect(value).toBeNull();
        done();
      });
    });

    it('seeds the current profile from storage on construction', (done) => {
      localStorage.setItem(
        'ot-leads-selectedProfile',
        JSON.stringify(profile('stored'))
      );

      const service = build();

      service.currentProfile$.subscribe((value) => {
        expect(value).toEqual(profile('stored'));
        done();
      });
    });

    it('has no token to hand out', () => {
      expect(build().getToken()).toBeNull();
    });
  });

  describe('on the server', () => {
    it('does not restore a session on construction', () => {
      const service = build('server');

      expect(auth.currentSession).not.toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(false);
    });

    it('rejects a login attempt', async () => {
      const service = build('server');

      await expect(
        service.login({ email: 'a@b.c', password: 'pw' } as never)
      ).rejects.toThrow('Login is not available on this platform.');
      expect(auth.login).not.toHaveBeenCalled();
    });

    it('does nothing on logout', () => {
      const service = build('server');

      service.logout();

      expect(auth.logout).not.toHaveBeenCalled();
    });

    it('reports no decoded token or persisted state', () => {
      const service = build('server');

      expect(service.getDecodedTokenValue()).toBeNull();
      expect(service.getPersistedProfiles()).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();
    });

    it('skips persistence writes entirely', () => {
      const service = build('server');

      service.persistProfiles([profile()]);
      service.persistSelectedProfile(profile());

      expect(localStorage.getItem('ot-leads-profiles')).toBeNull();
      expect(localStorage.getItem('ot-leads-selectedProfile')).toBeNull();
    });

    it('resolves restoreSession without calling the auth service', async () => {
      const service = build('server');

      await expect(service.restoreSession()).resolves.toBeUndefined();
      expect(auth.currentSession).not.toHaveBeenCalled();
    });
  });
});
