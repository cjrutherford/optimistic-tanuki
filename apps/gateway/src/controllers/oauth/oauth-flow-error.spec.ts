import { readFileSync } from 'fs';
import { join } from 'path';
import {
  GUARDIAN_RETURN_PATHS,
  OAUTH_ERROR_DESCRIPTIONS,
  guardianReturnPathFor,
  isAgeGatedApp,
} from './oauth-flow-error';

describe('OAuth error codes and the shared UI error map', () => {
  it('has a user-facing entry in auth-ui for every gateway error code', () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../../../../libs/auth-ui/src/lib/oauth-callback/oauth-errors.ts'
      ),
      'utf8'
    );
    const missing = Object.keys(OAUTH_ERROR_DESCRIPTIONS).filter(
      (code) => !new RegExp(`^\\s+${code}: \\{`, 'm').test(source)
    );
    expect(missing).toEqual([]);
  });
});

describe('guardian return paths', () => {
  it('maps exactly the age-gated apps to their register route', () => {
    expect(guardianReturnPathFor('client-interface')).toBe('/register');
    expect(guardianReturnPathFor('local-hub')).toBe('/register');
    expect(Object.keys(GUARDIAN_RETURN_PATHS).sort()).toEqual([
      'client-interface',
      'local-hub',
    ]);
  });

  it('fails explicitly instead of defaulting for an unmapped app', () => {
    for (const app of ['forgeofwill', 'owner-console', 'constructor', '']) {
      expect(isAgeGatedApp(app)).toBe(false);
      expect(() => guardianReturnPathFor(app)).toThrow(
        'No guardian return path'
      );
    }
  });
});
