export interface NamedThrottleLimit {
  name: 'short' | 'medium' | 'long';
  ttl: number;
  limit: number;
}

const profiles = {
  production: { short: 100, medium: 300, long: 1200 },
  relaxed: { short: 1000, medium: 5000, long: 20000 },
} as const;

const ceilings = { short: 2000, medium: 10000, long: 40000 } as const;

export function boundedThrottleLimit(
  key: string,
  fallback: number,
  maximum: number,
  env: NodeJS.ProcessEnv
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${key} must be a positive integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${key} must be between 1 and ${maximum}.`);
  }
  return value;
}

export function gatewayWriteLimit(
  key: string,
  productionDefault: number,
  relaxedDefault: number,
  maximum: number,
  env: NodeJS.ProcessEnv = process.env
): number {
  const profile = env.THROTTLER_PROFILE ?? 'production';
  if (profile !== 'production' && profile !== 'relaxed') {
    throw new Error('THROTTLER_PROFILE must be production or relaxed.');
  }
  if (
    profile === 'relaxed' &&
    env.NODE_ENV !== 'development' &&
    env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'The relaxed throttler profile requires NODE_ENV=development or test.'
    );
  }
  return boundedThrottleLimit(
    key,
    profile === 'relaxed' ? relaxedDefault : productionDefault,
    maximum,
    env
  );
}

/**
 * The default profile is deliberately bounded for production. Relaxed limits
 * require an explicit non-production profile so test convenience cannot leak
 * into a production deployment.
 */
export function gatewayThrottleLimits(
  env: NodeJS.ProcessEnv = process.env
): NamedThrottleLimit[] {
  const requestedProfile = env.THROTTLER_PROFILE ?? 'production';
  if (requestedProfile !== 'production' && requestedProfile !== 'relaxed') {
    throw new Error('THROTTLER_PROFILE must be production or relaxed.');
  }
  if (
    requestedProfile === 'relaxed' &&
    env.NODE_ENV !== 'development' &&
    env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'The relaxed throttler profile requires NODE_ENV=development or test.'
    );
  }

  const profile = profiles[requestedProfile];
  return [
    {
      name: 'short',
      ttl: 1000,
      limit: boundedThrottleLimit(
        'THROTTLE_SHORT_LIMIT',
        profile.short,
        ceilings.short,
        env
      ),
    },
    {
      name: 'medium',
      ttl: 10000,
      limit: boundedThrottleLimit(
        'THROTTLE_MEDIUM_LIMIT',
        profile.medium,
        ceilings.medium,
        env
      ),
    },
    {
      name: 'long',
      ttl: 60000,
      limit: boundedThrottleLimit(
        'THROTTLE_LONG_LIMIT',
        profile.long,
        ceilings.long,
        env
      ),
    },
  ];
}
