import { runPendingRuntime } from './register-pending-runtime';
import { assertRestoreProtocolAvailable } from './restore-fence';
import 'reflect-metadata';
import { start } from './server';
import dataSource from './data-source';
import { DirectoryReconciler, configureReceiptPool } from './reconciliation';
import { createReceiptServer } from './receipt-server';
import { SocialDelivery } from '../../directory-worker/src/social-delivery';
import { censusPage } from '../../directory-worker/src/census';
import { readRecoveryEpochs } from './recovery-authority';
import { accountLifecycleConfig } from './account-lifecycle-server';
import { createDirectoryLifecycleHandler } from './account-lifecycle-runtime';

async function main() {
  if (process.env.DIRECTORY_MODE === 'register-pending-v1') return runPendingRuntime();
  assertRestoreProtocolAvailable();
  const social = new SocialDelivery(process.env.SOCIAL_HOST || '', Number(process.env.SOCIAL_PORT || 3003), process.env.DIRECTORY_SOCIAL_SECRET || '');
  const reconciler = new DirectoryReconciler(dataSource, async id => social.snapshot(id, (await readRecoveryEpochs(dataSource)).sourceEpoch), async (revision, id, epoch, nonce) => social.membership(revision, id, epoch, nonce));
  const server = createReceiptServer(dataSource, reconciler, process.env.DIRECTORY_SERVICE_SECRET || '', process.env.DIRECTORY_RECEIPT_SIGNING_SECRET || '', process.env.DIRECTORY_SOCIAL_SECRET || '');
  if (!process.env.SOCIAL_HOST || !process.env.DIRECTORY_DATABASE_URL) throw new Error('SOCIAL_HOST and DIRECTORY_DATABASE_URL are required');
  await dataSource.initialize();
  const capacity = process.env.DIRECTORY_RECEIPT_CAPACITY;
  if (!capacity || !/^[1-9][0-9]*$/.test(capacity)) throw new Error('DIRECTORY_RECEIPT_CAPACITY is required');
  await configureReceiptPool(dataSource, Number(capacity));
  server.listen(Number(process.env.DIRECTORY_RECEIPT_PORT || 3122), '0.0.0.0');
  // Not mounted without DIRECTORY_ACCOUNT_DELETION_SECRET: Authentication then blocks deletion and export instead of skipping Directory.
  const lifecycleConfig = accountLifecycleConfig(process.env, [process.env.DIRECTORY_SERVICE_SECRET, process.env.DIRECTORY_SOCIAL_SECRET, process.env.DIRECTORY_RECEIPT_SIGNING_SECRET]);
  start(Number(process.env.DIRECTORY_PORT || 3120), [], lifecycleConfig && createDirectoryLifecycleHandler(dataSource, lifecycleConfig));
  let cleanupCursor = '0';
  while (true) {
    let delay = 5000;
    try {
      const receipts: Array<{ eventId: string; communityId: string; eventNonce: string; sourceEpoch: string; recoveryEpoch: string }> = await dataSource.query('SELECT "eventId", "communityId", "eventNonce", "sourceEpoch", "recoveryEpoch" FROM directory_reconciliation_receipt WHERE "eventId" > $1 ORDER BY "eventId" LIMIT 100', [cleanupCursor]);
      for (const receipt of receipts) {
        cleanupCursor = receipt.eventId;
        try { await reconciler.cleanup({ revision: receipt.eventId, communityId: receipt.communityId, eventNonce: receipt.eventNonce, sourceEpoch: receipt.sourceEpoch, recoveryEpoch: receipt.recoveryEpoch }); }
        catch { console.error('Directory receipt cleanup failed; retrying in a later sweep'); }
      }
      if (receipts.length < 100) cleanupCursor = '0';
    } catch { console.error('Directory receipt cleanup failed; retrying'); }
    try { if (await censusPage(dataSource, { census: async cursor => social.census(cursor, (await readRecoveryEpochs(dataSource)).sourceEpoch) }, reconciler) === 'complete') delay = 15 * 60 * 1000; }
    catch { console.error('Directory census failed; retrying'); }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
main().catch(() => { console.error('Directory failed to start'); process.exit(1); });
