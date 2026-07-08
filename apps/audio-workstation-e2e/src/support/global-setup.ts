import { waitForPortOpen } from '@nx/node/utils';

export default async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3025;

  console.log('\nWaiting for audio-workstation on :' + port + '...\n');

  try {
    await waitForPortOpen(port, { host, retries: 60, retryDelay: 2000 });
    console.log('\naudio-workstation is open!\n');
  } catch (err) {
    console.error(
      '\nTimed out waiting for audio-workstation on :' + port + '.\n'
    );
    throw err;
  }

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
}
