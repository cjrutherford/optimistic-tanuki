import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { DataSource } from 'typeorm';
import { DirectoryReconciler } from './reconciliation';
import { canonicalReceiptV2, signReceiptV2 } from './receipt-v2-identity';
import { readRecoveryEpochs } from './recovery-authority';

export function createReceiptServer(db: Pick<DataSource, 'query' | 'transaction'>, reconciler: Pick<DirectoryReconciler, 'apply'>, serviceSecret: string, signingSecret: string, socialSecret: string) {
  if ([serviceSecret, signingSecret, socialSecret].some(s => !s || Buffer.byteLength(s) < 32) || new Set([serviceSecret, signingSecret, socialSecret]).size !== 3) throw new Error('Distinct directory service, Social and receipt secrets of at least 32 bytes are required');
  return createServer(async (req, res) => {
    const supplied = Buffer.from(req.headers['authorization'] || '');
    const expected = Buffer.from(`Bearer ${serviceSecret}`);
    if (req.method !== 'POST' || req.url !== '/internal/receipts' || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { res.writeHead(403).end(); return; }
    try {
      let body = '';
      for await (const chunk of req) { body += chunk.toString(); if (body.length > 1024) throw new Error('Request too large'); }
      const { revision, communityId, eventNonce, sourceEpoch } = JSON.parse(body);
      const epochs = await readRecoveryEpochs(db);
      const identity = { revision, communityId, eventNonce, sourceEpoch, recoveryEpoch: epochs.recoveryEpoch };
      canonicalReceiptV2(identity);
      if (sourceEpoch !== epochs.sourceEpoch) throw new Error('Recovery epoch mismatch');
      const result = await reconciler.apply(identity);
      if (result === 'retired') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ ...identity, status: 'retired' })); return; }
      const attestation = await db.transaction(async manager => {
        await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))");
        const current = await readRecoveryEpochs(manager);
        if (current.sourceEpoch !== sourceEpoch || current.recoveryEpoch !== identity.recoveryEpoch) throw new Error('Recovery epoch mismatch');
        const rows = await manager.query('SELECT 1 FROM directory_reconciliation_receipt WHERE "eventId"=$1 AND "communityId"=$2 AND "eventNonce"=$3 AND "sourceEpoch"=$4 AND "recoveryEpoch"=$5', [revision, communityId, eventNonce, sourceEpoch, identity.recoveryEpoch]);
        if (rows.length !== 1) throw new Error('Receipt not committed');
        return signReceiptV2(signingSecret, identity);
      });
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ ...identity, attestation }));
    } catch { res.writeHead(503).end(); }
  });
}
