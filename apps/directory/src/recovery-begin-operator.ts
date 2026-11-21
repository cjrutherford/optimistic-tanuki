import db from './data-source';
import { beginRecovery } from './recovery-authority';

async function main() {
  const [
    confirmation,
    sourceEpoch,
    activationId,
    owner,
    socialGeneration,
    ...extra
  ] = process.argv.slice(2);
  if (
    confirmation !== '--confirm-external-fence' ||
    !sourceEpoch ||
    !activationId ||
    !owner ||
    !socialGeneration ||
    extra.length ||
    !process.env.DIRECTORY_DATABASE_URL
  )
    throw new Error(
      'Usage: recovery-begin-operator --confirm-external-fence <sourceEpoch> <activationId> <owner> <socialGeneration>'
    );
  await db.initialize();
  try {
    process.stdout.write(
      JSON.stringify(
        await beginRecovery(db, {
          sourceEpoch,
          activationId,
          owner,
          socialGeneration,
        })
      ) + '\n'
    );
  } finally {
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
