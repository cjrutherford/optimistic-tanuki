/**
 * The stack's owner account, shared by global setup (which provisions it) and
 * the full-stack specs (which sign in with it).
 *
 * Locally, a missing OWNER_EMAIL / OWNER_PASSWORD means "no owner here": the
 * specs skip and say why. In CI it is a configuration error, so this throws
 * rather than letting the suite pass with every test skipped.
 */
export interface OwnerCredentials {
  email: string;
  password: string;
}

export const OWNER_ENV_MISSING_REASON =
  'OWNER_EMAIL and OWNER_PASSWORD are not set: the stack has no provisioned owner account';

export function ownerCredentials(
  env: NodeJS.ProcessEnv = process.env
): OwnerCredentials | null {
  const email = env['OWNER_EMAIL']?.trim();
  const password = env['OWNER_PASSWORD'];
  if (email && password) return { email, password };
  if (env['CI']) {
    throw new Error(
      `${OWNER_ENV_MISSING_REASON}. The full-stack owner-console specs must not skip in CI: set OWNER_EMAIL and OWNER_PASSWORD for the stack run (see e2e/README.md, "Owner console owner account").`
    );
  }
  return null;
}
