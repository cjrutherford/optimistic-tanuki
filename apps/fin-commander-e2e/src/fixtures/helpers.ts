const DEFAULT_RETRIES = 30;
const DEFAULT_RETRY_INTERVAL_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(
  url: string,
  success: (response: Response) => boolean,
  waitingMessage: string,
  failureMessage: string
): Promise<void> {
  for (let attempt = 0; attempt < DEFAULT_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url);
      if (success(response)) {
        return;
      }
    } catch {
      // service still starting
    }

    console.log(`${waitingMessage} (${attempt + 1}/${DEFAULT_RETRIES})`);
    await delay(DEFAULT_RETRY_INTERVAL_MS);
  }

  throw new Error(failureMessage);
}

export function getBaseUrl(): string {
  return process.env['BASE_URL'] || 'http://127.0.0.1:8089';
}

export function getGatewayUrl(): string {
  return process.env['GATEWAY_URL'] || 'http://127.0.0.1:3000';
}

export async function waitForFinCommander(): Promise<void> {
  await waitForUrl(
    getBaseUrl(),
    (response) => response.ok,
    'Waiting for Fin Commander frontend...',
    'Fin Commander frontend failed to start'
  );
}

export async function waitForGateway(): Promise<void> {
  await waitForUrl(
    `${getGatewayUrl()}/api-docs`,
    (response) => response.ok,
    'Waiting for gateway API docs...',
    'Gateway API docs failed to become ready'
  );
}
