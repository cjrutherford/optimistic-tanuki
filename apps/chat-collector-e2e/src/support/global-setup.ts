import { waitForPortOpen } from '@nx/node/utils';

export default async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const baseUrl = process.env.BASE_URL;
  const parsedBaseUrl = baseUrl ? new URL(baseUrl) : undefined;
  const resolvedHost = process.env.HOST ?? parsedBaseUrl?.hostname ?? host;
  const resolvedPort = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : parsedBaseUrl?.port
    ? parseInt(parsedBaseUrl.port, 10)
    : port;
  const target = resolvedHost + ':' + resolvedPort;

  console.log('\nWaiting for ' + target + ' to be open...\n');

  try {
    await waitForPortOpen(resolvedPort, {
      host: resolvedHost,
      retries: 60,
      retryDelay: 2000,
    });
    console.log('\n' + target + ' is open!\n');
  } catch (err) {
    console.error('\nTimed out waiting for ' + target + ' to be open.\n');
    throw err;
  }

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
}
