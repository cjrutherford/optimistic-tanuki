import type { AppRegistration } from './app-registry.types';
import { isApprovedAuthEmailSender } from './auth-email';
import { DEFAULT_APP_REGISTRY } from './default-registry';

describe('app email authentication metadata', () => {
  it('supports a root-domain sender independently from the UI subdomain', () => {
    const app: AppRegistration = {
      appId: 'system-configurator',
      name: 'HAI Computer',
      domain: 'hopefulaspirationsindustries.com',
      uiBaseUrl: 'https://hardware.hopefulaspirationsindustries.com',
      apiBaseUrl: 'https://hardware.hopefulaspirationsindustries.com/api',
      appType: 'client',
      visibility: 'public',
      authEmail: {
        enabled: true,
        from: 'no-reply@hopefulaspirationsindustries.com',
      },
    };
    expect(app.authEmail?.from).toBe(
      'no-reply@hopefulaspirationsindustries.com'
    );
  });

  it('allows only the five configured root mail domains', () => {
    expect(isApprovedAuthEmailSender('no-reply@towne-square.com')).toBe(true);
    expect(isApprovedAuthEmailSender('no-reply@app.towne-square.com')).toBe(
      false
    );
  });

  it('configures every authentication-enabled UI with an approved sender', () => {
    const configured = DEFAULT_APP_REGISTRY.apps.filter(
      (app) => app.authEmail?.enabled
    );
    // Update when an app genuinely gains or loses authentication, not to
    // quiet a failure. The assertion below is the one that matters: every
    // sender has to be on an approved domain.
    expect(configured).toHaveLength(12);
    expect(
      configured.every((app) => isApprovedAuthEmailSender(app.authEmail!.from))
    ).toBe(true);
  });
});
