export const OWNER_BOOTSTRAP_USAGE = `Usage: pnpm bootstrap:owner --name "Owner Name" --email owner@example.com --password "secret" [--api-base-url http://127.0.0.1:8098/api] [--mark-setup-complete]`;

export type OwnerBootstrapCliOptions = {
  apiBaseUrl: string;
  email: string;
  markSetupComplete: boolean;
  name: string;
  password: string;
};

type FetchLike = typeof fetch;

export function parseOwnerBootstrapArgs(
  args: string[]
): OwnerBootstrapCliOptions {
  const values: Partial<OwnerBootstrapCliOptions> = {
    apiBaseUrl: 'http://127.0.0.1:8098/api',
    markSetupComplete: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--mark-setup-complete') {
      values.markSetupComplete = true;
      continue;
    }

    const nextValue = args[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`${OWNER_BOOTSTRAP_USAGE}\n\nMissing value for ${arg}`);
    }

    switch (arg) {
      case '--name':
        values.name = nextValue.trim();
        break;
      case '--email':
        values.email = nextValue.trim().toLowerCase();
        break;
      case '--password':
        values.password = nextValue;
        break;
      case '--api-base-url':
        values.apiBaseUrl = trimTrailingSlash(nextValue.trim());
        break;
      default:
        throw new Error(`${OWNER_BOOTSTRAP_USAGE}\n\nUnknown argument: ${arg}`);
    }

    index += 1;
  }

  if (!values.name) {
    throw new Error(
      `${OWNER_BOOTSTRAP_USAGE}\n\nMissing required argument: --name`
    );
  }

  if (!values.email) {
    throw new Error(
      `${OWNER_BOOTSTRAP_USAGE}\n\nMissing required argument: --email`
    );
  }

  if (!values.password) {
    throw new Error(
      `${OWNER_BOOTSTRAP_USAGE}\n\nMissing required argument: --password`
    );
  }

  return values as OwnerBootstrapCliOptions;
}

export async function bootstrapOwnerAccount(
  options: OwnerBootstrapCliOptions,
  fetchImpl: FetchLike = fetch
): Promise<{
  email: string;
  name: string;
  profileId: string;
  setupComplete: boolean;
  userId: string;
}> {
  const createResponse = await fetchImpl(
    `${options.apiBaseUrl}/bootstrap/owner`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.name,
        email: options.email,
        password: options.password,
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error(
      await buildBootstrapError(createResponse, 'owner creation')
    );
  }

  const createdOwner = (await createResponse.json()) as {
    email?: string;
    name?: string;
    profileId?: string;
    userId?: string;
  };

  if (options.markSetupComplete) {
    const activateResponse = await fetchImpl(
      `${options.apiBaseUrl}/bootstrap/owner/activate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!activateResponse.ok) {
      throw new Error(
        await buildBootstrapError(activateResponse, 'setup completion')
      );
    }
  }

  return {
    email: createdOwner.email ?? options.email,
    name: createdOwner.name ?? options.name,
    profileId: createdOwner.profileId ?? '',
    setupComplete: options.markSetupComplete,
    userId: createdOwner.userId ?? '',
  };
}

export async function runOwnerBootstrapCli(
  args: string[] = process.argv.slice(2),
  io: Pick<Console, 'error' | 'log'> = console,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  try {
    const options = parseOwnerBootstrapArgs(args);
    const result = await bootstrapOwnerAccount(options, fetchImpl);

    io.log(
      [
        `Owner created: ${result.email}`,
        result.userId ? `User ID: ${result.userId}` : 'User ID: unavailable',
        result.profileId
          ? `Profile ID: ${result.profileId}`
          : 'Profile ID: unavailable',
        `Setup complete marked: ${result.setupComplete ? 'yes' : 'no'}`,
      ].join('\n')
    );
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function buildBootstrapError(
  response: Response,
  phase: string
): Promise<string> {
  const body = await response.text();
  const suffix = body ? `: ${body}` : '';
  return `Owner bootstrap ${phase} failed (${response.status})${suffix}`;
}
