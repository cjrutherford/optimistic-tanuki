import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import { AuthStateService, UserData } from './auth-state.service';

const API = 'http://api.test';
const SESSION_URL = `${API}/authentication/session`;
const LOGOUT_URL = `${API}/authentication/logout`;

const USER: UserData = {
  userId: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  profileId: 'p1',
};

const PROFILE = { id: 'p1', profileName: 'Ada' } as ProfileDto;

describe('AuthStateService', () => {
  let httpMock: HttpTestingController;
  let login: jest.Mock;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const configure = (platformId: string) => {
    login = jest.fn().mockResolvedValue({ data: {} });
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthStateService,
        { provide: AuthenticationService, useValue: { login } },
        { provide: API_BASE_URL, useValue: API },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthStateService);
  };

  beforeEach(() => {
    localStorage.clear();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('in the browser', () => {
    it('restores the session on construction and marks the user authenticated', async () => {
      const service = configure('browser');

      const req = httpMock.expectOne(SESSION_URL);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: USER });
      await Promise.resolve();

      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(USER);
      await expect(firstValueFrom(service.isAuthenticated$)).resolves.toBe(
        true
      );
      httpMock.verify();
    });

    it('clears state when the session probe fails', async () => {
      const service = configure('browser');

      httpMock
        .expectOne(SESSION_URL)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      await Promise.resolve();

      expect(service.isAuthenticated).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(service.getDecodedTokenValue()).toBeNull();
      httpMock.verify();
    });

    it('seeds currentProfile$ from the persisted selected profile', async () => {
      localStorage.setItem(
        'ot-client-selectedProfile',
        JSON.stringify(PROFILE)
      );
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });

      await expect(firstValueFrom(service.currentProfile$)).resolves.toEqual(
        PROFILE
      );
    });

    it('logs in through the authentication service and then restores the session', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();

      const pending = service.login({
        email: 'ada@example.com',
        password: 'pw',
      } as never);
      await Promise.resolve();
      httpMock.expectOne(SESSION_URL).flush({ data: USER });

      await expect(pending).resolves.toEqual({ data: {} });
      expect(login).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'pw',
      });
      httpMock.verify();
    });

    it('defaults a missing profileId to an empty string in setSession', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();

      service.setSession({ userId: 'u2', name: 'Bo', email: 'bo@x.com' });

      expect(service.getDecodedTokenValue()).toEqual({
        userId: 'u2',
        name: 'Bo',
        email: 'bo@x.com',
        profileId: '',
      });
    });

    it('setToken stores the token in memory and clears the decoded token', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();

      service.setToken('jwt-token');

      expect(service.getToken()).toBe('jwt-token');
      expect(service.getDecodedTokenValue()).toBeNull();
      expect(service.isAuthenticated).toBe(true);
      // The token is deliberately not persisted to localStorage.
      expect(localStorage.getItem('ot-client-authToken')).toBeNull();
    });

    it('logout posts the current token, clears storage and resets state', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();
      service.setToken('jwt-token');
      service.persistProfiles([PROFILE]);
      service.persistSelectedProfile(PROFILE);

      service.logout();

      const req = httpMock.expectOne(LOGOUT_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'jwt-token' });
      expect(req.request.withCredentials).toBe(true);
      req.flush({});

      expect(service.isAuthenticated).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem('ot-client-profiles')).toBeNull();
      expect(localStorage.getItem('ot-client-selectedProfile')).toBeNull();
      await expect(firstValueFrom(service.currentProfile$)).resolves.toBeNull();
      httpMock.verify();
    });

    it('logout posts an empty body when there is no token', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();

      service.logout();

      const req = httpMock.expectOne(LOGOUT_URL);
      expect(req.request.body).toEqual({});
      req.flush({});
      httpMock.verify();
    });

    it('logout survives a failing gateway call', async () => {
      const service = configure('browser');
      httpMock.expectOne(SESSION_URL).flush({ data: USER });
      await Promise.resolve();

      service.logout();
      httpMock
        .expectOne(LOGOUT_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to invalidate session on gateway:',
        expect.anything()
      );
      expect(service.isAuthenticated).toBe(false);
      httpMock.verify();
    });

    describe('persistence helpers', () => {
      let service: AuthStateService;

      beforeEach(async () => {
        service = configure('browser');
        httpMock.expectOne(SESSION_URL).flush({ data: USER });
        await Promise.resolve();
      });

      it('round-trips the profile list', () => {
        service.persistProfiles([PROFILE]);
        expect(service.getPersistedProfiles()).toEqual([PROFILE]);
      });

      it('removes the profile list when given null', () => {
        service.persistProfiles([PROFILE]);
        service.persistProfiles(null);
        expect(service.getPersistedProfiles()).toBeNull();
      });

      it('round-trips the selected profile and pushes it to currentProfile$', async () => {
        service.persistSelectedProfile(PROFILE);
        expect(service.getPersistedSelectedProfile()).toEqual(PROFILE);
        await expect(firstValueFrom(service.currentProfile$)).resolves.toEqual(
          PROFILE
        );
      });

      it('clears the selected profile when given null', async () => {
        service.persistSelectedProfile(PROFILE);
        service.persistSelectedProfile(null);
        expect(service.getPersistedSelectedProfile()).toBeNull();
        await expect(
          firstValueFrom(service.currentProfile$)
        ).resolves.toBeNull();
      });
    });
  });

  describe('on the server', () => {
    let service: AuthStateService;

    beforeEach(() => {
      service = configure('server');
    });

    it('does not probe the session on construction', () => {
      httpMock.verify();
    });

    it('reports itself unauthenticated', () => {
      expect(service.isAuthenticated).toBe(false);
    });

    it('rejects login attempts', async () => {
      await expect(
        service.login({ email: 'a', password: 'b' } as never)
      ).rejects.toBe('Login is not available on this platform.');
      expect(login).not.toHaveBeenCalled();
    });

    it('resolves restoreSession to false without an http call', async () => {
      await expect(service.restoreSession()).resolves.toBe(false);
      httpMock.verify();
    });

    it('turns every state mutation into a no-op', () => {
      service.setSession(USER);
      service.setToken('jwt');
      service.logout();
      service.persistProfiles([PROFILE]);
      service.persistSelectedProfile(PROFILE);

      expect(service.getToken()).toBeNull();
      expect(service.getDecodedTokenValue()).toBeNull();
      expect(service.getPersistedProfiles()).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();
      expect(localStorage.length).toBe(0);
      httpMock.verify();
    });
  });
});
