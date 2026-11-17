import 'reflect-metadata';
import dataSource from '../../directory/src/data-source';
import { recoveryPage } from '../../directory/src/recovery-traversal';
import { RecoveryClient } from './recovery-client';

/** External stop-and-drain fencing remains an operator prerequisite. */
async function main() {
  const [
    action,
    confirmation,
    sourceEpoch,
    recoveryEpoch,
    owner,
    activationId,
    socialGeneration,
    directoryGeneration,
    ...extra
  ] = process.argv.slice(2);
  if (
    action !== 'run' ||
    confirmation !== '--confirm-external-fence' ||
    extra.length ||
    !process.env.DIRECTORY_DATABASE_URL ||
    !sourceEpoch ||
    !recoveryEpoch ||
    !owner ||
    !activationId ||
    !socialGeneration ||
    !directoryGeneration
  ) {
    throw Error(
      'Usage: recovery-operator run --confirm-external-fence SOURCE_EPOCH RECOVERY_EPOCH OWNER ACTIVATION_ID SOCIAL_GENERATION DIRECTORY_GENERATION'
    );
  }
  const port = Number(process.env.SOCIAL_PORT || '3003');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('Invalid SOCIAL_PORT');
  if (!process.env.SOCIAL_HOST) throw Error('SOCIAL_HOST is required');
  const client = new RecoveryClient(
    process.env.SOCIAL_HOST,
    port,
    process.env.DIRECTORY_RECOVERY_READ_SECRET || ''
  );
  try {
    await dataSource.initialize();
    let result: 'busy' | 'more' | 'traversed';
    do {
      result = await recoveryPage(dataSource, client, {
        sourceEpoch,
        recoveryEpoch,
        owner,
        activationId,
        socialGeneration,
        directoryGeneration,
      });
    } while (result === 'more');
    if (result === 'busy')
      throw Error('Another recovery session holds the lock');
    console.log(
      'Traversal finished; recovery remains blocked pending outbox and protocol review.'
    );
  } finally {
    client.close();
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
main().catch(() => {
  console.error(
    'Directory recovery traversal failed; external fence remains required.'
  );
  process.exitCode = 1;
});
