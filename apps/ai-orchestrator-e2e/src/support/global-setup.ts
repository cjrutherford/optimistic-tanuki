import { waitForPortOpen } from '@nx/node/utils';

export default async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  console.log("\nWaiting for : to be open...\n");

  try {
    await waitForPortOpen(port, { host, retries: 60, retryDelay: 2000 });
    console.log("\n: is open!\n");
  } catch (err) {
    console.error("\nTimed out waiting for : to be open.\n");
    throw err;
  }

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
}
