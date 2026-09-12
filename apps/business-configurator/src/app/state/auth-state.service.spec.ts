import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  it('does not resolve login until the cookie session is restored', async () => {
    const login = jest.fn().mockResolvedValue({ data: {} });
    const currentSession = jest.fn().mockResolvedValue({
      data: { userId: 'owner-1', email: 'owner@example.com' },
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthenticationService, useValue: { login, currentSession } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    await service.login({ email: 'owner@example.com', password: 'secret' });

    expect(login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret',
    });
    expect(currentSession).toHaveBeenCalled();
    expect(service.isAuthenticated).toBe(true);
  });

  it('rejects login when the cookie session cannot be restored', async () => {
    const login = jest.fn().mockResolvedValue({ data: {} });
    const currentSession = jest.fn().mockRejectedValue(new Error('expired'));

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthenticationService, useValue: { login, currentSession } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AuthStateService);

    await expect(
      service.login({ email: 'owner@example.com', password: 'secret' })
    ).rejects.toThrow('Unable to restore the configurator session');
    expect(service.isAuthenticated).toBe(false);
    expect(service.status).toBe('signed-out');
  });

  it('exposes an expired state while preserving the cookie-session boundary', () => {
    const logout = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService,
          useValue: { logout },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    service.markExpired('/workspaces/one/sites/alpha');

    expect(service.status).toBe('expired');
    expect(service.isAuthenticated).toBe(false);
    expect(service.recovery).toEqual({
      reason: 'expired',
      returnUrl: '/workspaces/one/sites/alpha',
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('does not start another logout request when logout handling receives a 401', () => {
    const logout = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService,
          useValue: { logout },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AuthStateService);
    service.logout();
    service.logout();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
