import { SsoSessionService } from './sso-session.service';

describe('SsoSessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores and clears an exchanged token', () => {
    const service = new SsoSessionService();

    service.storeSession({
      token: 'target-token',
      targetAppId: 'system-configurator',
      expiresAt: '2026-04-23T12:00:00Z',
    });

    expect(service.getToken()).toBe('target-token');
    expect(service.getSession()).toEqual({
      token: 'target-token',
      targetAppId: 'system-configurator',
      expiresAt: '2026-04-23T12:00:00Z',
    });

    service.clearSession();

    expect(service.getToken()).toBeNull();
    expect(service.getSession()).toBeNull();
  });
});
