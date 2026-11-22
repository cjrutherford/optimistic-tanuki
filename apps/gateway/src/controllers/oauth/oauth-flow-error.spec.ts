import { readFileSync } from 'fs';
import { join } from 'path';
import { OAUTH_ERROR_DESCRIPTIONS } from './oauth-flow-error';

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
