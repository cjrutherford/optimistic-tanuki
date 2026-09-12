import {
  BusinessAuthState,
  BusinessIdentity,
  BusinessSessionMetadata,
  createBusinessAuthState,
  normalizeBusinessReturnTo,
  transitionBusinessAuthState,
} from './business-auth.state';

const identity: BusinessIdentity = {
  userId: 'user-1',
  profileId: 'profile-1',
  email: 'user@example.com',
  name: 'Business User',
};

const session: BusinessSessionMetadata = {
  kind: 'owner',
  appScope: 'business-site',
  transport: 'cookie',
};

describe('business auth state contract', () => {
  it('starts signed out without identity or session metadata', () => {
    expect(createBusinessAuthState()).toEqual<BusinessAuthState>({
      status: 'signed-out',
      identity: null,
      session: null,
      recovery: null,
    });
  });

  it('transitions restore start to loading and clears stale session data', () => {
    const state = transitionBusinessAuthState(
      {
        status: 'signed-in',
        identity,
        session,
        recovery: null,
      },
      { type: 'restore-start' }
    );

    expect(state).toEqual({
      status: 'loading',
      identity: null,
      session: null,
      recovery: null,
    });
  });

  it('transitions restore success to signed in with typed identity metadata', () => {
    expect(
      transitionBusinessAuthState(createBusinessAuthState(), {
        type: 'restore-success',
        identity,
        session,
      })
    ).toEqual({
      status: 'signed-in',
      identity,
      session,
      recovery: null,
    });
  });

  it('transitions unauthorized to expired with a safe recovery intent', () => {
    expect(
      transitionBusinessAuthState(
        {
          status: 'signed-in',
          identity,
          session,
          recovery: null,
        },
        { type: 'unauthorized', returnTo: '/owner/settings?tab=profile' }
      )
    ).toEqual({
      status: 'expired',
      identity: null,
      session: null,
      recovery: {
        reason: 'unauthorized',
        returnTo: '/owner/settings?tab=profile',
      },
    });
  });

  it('transitions expiry to expired without retaining identity', () => {
    expect(
      transitionBusinessAuthState(
        {
          status: 'signed-in',
          identity,
          session,
          recovery: null,
        },
        { type: 'expiry', returnTo: '/client/bookings' }
      )
    ).toEqual({
      status: 'expired',
      identity: null,
      session: null,
      recovery: {
        reason: 'expired',
        returnTo: '/client/bookings',
      },
    });
  });

  it('transitions sign out to signed out and drops recovery intent', () => {
    expect(
      transitionBusinessAuthState(
        {
          status: 'expired',
          identity: null,
          session: null,
          recovery: { reason: 'unauthorized', returnTo: '/owner/settings' },
        },
        { type: 'sign-out' }
      )
    ).toEqual(createBusinessAuthState());
  });
});

describe('normalizeBusinessReturnTo', () => {
  it.each(['/dashboard', '/dashboard?tab=activity', '/dashboard#summary'])(
    'accepts the internal destination %s',
    (returnTo) => {
      expect(normalizeBusinessReturnTo(returnTo)).toBe(returnTo);
    }
  );

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    'javascript:alert(1)',
    '/%2F%2Fevil.example/phish',
    '/%5C%5Cevil.example/phish',
    '/dashboard\n/evil',
    '/login',
    '/login?returnTo=/dashboard',
    '/register',
  ])('rejects unsafe destination %s', (returnTo) => {
    expect(normalizeBusinessReturnTo(returnTo)).toBeNull();
  });

  it('rejects missing, blank, and whitespace-padded destinations', () => {
    expect(normalizeBusinessReturnTo(undefined)).toBeNull();
    expect(normalizeBusinessReturnTo('')).toBeNull();
    expect(normalizeBusinessReturnTo(' /dashboard')).toBeNull();
  });
});
