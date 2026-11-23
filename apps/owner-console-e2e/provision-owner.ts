import { OwnerCredentials } from './src/support/owner-credentials';

/**
 * Makes sure the stack has an owner the full-stack specs can sign in as.
 *
 * The stack has no startup bootstrap, so this registers the account in the
 * owner-console app scope, the same call scripts/dev-seed.sh makes. It goes
 * through the console's own /api proxy, as a browser would: the gateway binds
 * registration to a Host that matches the app's registered origin, so a direct
 * call to the gateway port is refused. Owner-console registration is open only while no
 * global profile exists; once an owner is there it answers "registration is
 * closed", which is fine as long as the credentials already sign in. The
 * closing login check is what makes this idempotent across reruns.
 */
const ownerOrigin = (): string =>
  (process.env['OWNER_CONSOLE_ORIGIN'] ?? 'http://127.0.0.1:8084').replace(
    /\/$/,
    ''
  );

const headers = (): Record<string, string> => ({
  'content-type': 'application/json',
  'x-ot-app-id': 'owner-console',
  'x-ot-appscope': 'owner-console',
  origin: ownerOrigin(),
});

async function canSignIn(owner: OwnerCredentials): Promise<boolean> {
  const response = await fetch(`${ownerOrigin()}/api/authentication/login`, {
    method: 'POST',
    headers: { ...headers(), 'X-ot-session-mode': 'cookie' },
    body: JSON.stringify({ email: owner.email, password: owner.password }),
  });
  return response.ok;
}

export async function provisionOwner(owner: OwnerCredentials): Promise<void> {
  if (await canSignIn(owner)) {
    console.log(`[owner-console-e2e] owner ${owner.email} already provisioned`);
    return;
  }

  const response = await fetch(`${ownerOrigin()}/api/authentication/register`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      fn: 'E2E',
      ln: 'Owner',
      email: owner.email,
      password: owner.password,
      confirm: owner.password,
      bio: 'Owner console e2e owner',
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    const closed = /registration is closed/i.test(body);
    throw new Error(
      closed
        ? `Owner ${owner.email} cannot sign in and owner-console registration is closed: the stack already has a different owner. Use that owner's OWNER_EMAIL/OWNER_PASSWORD or start a fresh stack.`
        : `Could not provision owner ${owner.email}: HTTP ${
            response.status
          } ${body.slice(0, 300)}`
    );
  }
  if (!(await canSignIn(owner))) {
    throw new Error(`Provisioned owner ${owner.email} but sign-in still fails`);
  }
  console.log(`[owner-console-e2e] provisioned owner ${owner.email}`);
}
