/** Run only in the Directory operator environment, never in the worker. */
import 'reflect-metadata';
import db from './data-source';
import { generateRecoveryProof } from './recovery-proof';

async function main(): Promise<void> {
  const [confirmation, sourceEpoch, recoveryEpoch, owner, activationId, socialGeneration, directoryGeneration, ...extra] = process.argv.slice(2);
  if (confirmation !== '--confirm-external-fence' || !sourceEpoch || !recoveryEpoch || !owner || !activationId || !socialGeneration || !directoryGeneration || extra.length || !process.env.DIRECTORY_DATABASE_URL) throw new Error('Usage: recovery-proof-operator --confirm-external-fence <sourceEpoch> <recoveryEpoch> <owner> <activationId> <socialGeneration> <directoryGeneration>');
  await db.initialize();
  try { process.stdout.write(JSON.stringify(await generateRecoveryProof(db, {sourceEpoch, recoveryEpoch, owner, activationId, socialGeneration, directoryGeneration}, process.env.DIRECTORY_RECOVERY_PROOF_SECRET || '')) + '\n'); }
  finally { await db.destroy(); }
}
main().catch(() => { process.stderr.write('Recovery proof generation failed; check authority and operator preconditions.\n'); process.exitCode = 1; });
