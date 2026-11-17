import db from './data-source';
import { beginRegisterRecovery, DirectoryRecoveryIdentity } from './register-recovery-authority';

async function main() {
  const [confirmation, sourceEpoch, activationId, socialGeneration, owner, previous, ...extra] = process.argv.slice(2);
  if (confirmation !== '--confirm-external-fence' || !sourceEpoch || !activationId || !socialGeneration || !owner || !previous || extra.length || !process.env.DIRECTORY_DATABASE_URL) throw Error('Usage: register-recovery-begin-operator --confirm-external-fence <sourceEpoch> <activationId> <socialGeneration> <owner> <previous-identity-json|absent>');
  const expectedPrevious: DirectoryRecoveryIdentity | null = previous === 'absent' ? null : JSON.parse(previous);
  await db.initialize();
  try { process.stdout.write(JSON.stringify(await beginRegisterRecovery(db, { sourceEpoch, activationId, socialGeneration, owner, expectedPrevious, externalFence: true })) + '\n'); }
  finally { await db.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
