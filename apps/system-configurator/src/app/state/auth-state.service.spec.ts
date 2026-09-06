import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from '../services/authentication.service';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let authServiceMock: {
    login: jest.Mock;
    currentSession: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(() => {
    localStorage.clear();
    authServiceMock = {
      login: jest.fn(),
      currentSession: jest.fn(),
      logout: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthenticationService, useValue: authServiceMock },
      ],
    });
    service = TestBed.inject(AuthStateService);
  });

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getDecodedTokenValue()).toBeNull();
  });

  it('restoreSession sets authenticated state on success', async () => {
    authServiceMock.currentSession.mockResolvedValue({
      data: { userId: 'u1', name: 'Hai', email: 'hai@example.com' },
    });

    await service.restoreSession();

    expect(service.isAuthenticated).toBe(true);
    expect(service.getDecodedTokenValue()).toEqual({
      userId: 'u1',
      name: 'Hai',
      email: 'hai@example.com',
      profileId: '',
    });

    let latest: boolean | undefined;
    service.isAuthenticated$().subscribe((v) => (latest = v));
    expect(latest).toBe(true);
  });

  it('restoreSession clears state on failure', async () => {
    authServiceMock.currentSession.mockRejectedValue(new Error('nope'));

    await service.restoreSession();

    expect(service.isAuthenticated).toBe(false);
    expect(service.getDecodedTokenValue()).toBeNull();
  });

  it('login calls authService.login then restores the session', async () => {
    authServiceMock.login.mockResolvedValue({ data: {} });
    authServiceMock.currentSession.mockResolvedValue({
      data: { userId: 'u2' },
    });

    const result = await service.login({
      email: 'hai@example.com',
      password: 'secret',
    });

    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: 'hai@example.com',
      password: 'secret',
    });
    expect(result).toEqual({ data: {} });
    expect(service.isAuthenticated).toBe(true);
  });

  it('logout clears storage and state and calls authService.logout', async () => {
    service.persistProfiles([{ id: 'p1' } as never]);
    service.persistSelectedProfile({ id: 'p1' } as never);
    authServiceMock.logout.mockResolvedValue(undefined);

    service.logout();

    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getPersistedProfiles()).toBeNull();
    expect(service.getPersistedSelectedProfile()).toBeNull();
    expect(authServiceMock.logout).toHaveBeenCalled();
  });

  it('logout tolerates authService.logout rejecting', async () => {
    authServiceMock.logout.mockRejectedValue(new Error('network'));
    expect(() => service.logout()).not.toThrow();
  });

  it('persists and retrieves profiles via localStorage', () => {
    const profiles = [{ id: 'p1' } as never, { id: 'p2' } as never];
    service.persistProfiles(profiles);
    expect(service.getPersistedProfiles()).toEqual(profiles);

    service.persistProfiles(null);
    expect(service.getPersistedProfiles()).toBeNull();
  });

  it('persists and retrieves the selected profile via localStorage', () => {
    const profile = { id: 'p1' } as never;
    service.persistSelectedProfile(profile);
    expect(service.getPersistedSelectedProfile()).toEqual(profile);

    service.persistSelectedProfile(null);
    expect(service.getPersistedSelectedProfile()).toBeNull();
  });
});
