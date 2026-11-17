#!/usr/bin/env node
/**
 * Owner-run, manual: attach verified source-freshness evidence to an existing
 * completed Overture scan. This is a network action (one anonymous HEAD); run it
 * only when you choose to. Without it, historical scans stay `unknown`.
 *
 *   --check (default)   verify and report; writes nothing
 *   --apply --confirm-database <db>   also insert the evidence row
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... DIRECTORY_BUDGET_DATABASE_URL=... \
 *   TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only \
 *     scripts/local-directory-source-freshness-attach.cjs \
 *       --inventory <inventory.json> --policy <policy.json> --scan <scanId> [--apply --confirm-database <db>]
 *
 * policy.json carries exactly the policy fields that went into the scan id:
 * itemId, approvalSha256, projectionSha256, classifierSha256, regions,
 * singleMatch, maxTransferBytes and envelope (the inventory envelope the scan
 * used). The scan id is recomputed as overture-private-extractor.mjs does and
 * must equal --scan and an existing completed scan; otherwise nothing happens.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const { DataSource } = require('typeorm');
const { insertSourceEvidence } = require('../apps/directory/src/source-evidence-store');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const REMOTE_ASSET = /^https:\/\/overturemaps-us-west-2\.s3\.us-west-2\.amazonaws\.com\/release\/(\d{4}-\d{2}-\d{2}\.\d+)\/theme=places\/type=place\/[^/]+\.parquet$/;

/** Same formula as overture-private-extractor.mjs (remote mode). */
function recomputeScanId(inventory, item, policy) {
  return digest(JSON.stringify({
    version: policy.singleMatch ? 6 : 5, mode: 'remote', inventory: inventory.inventorySha256, item: policy.itemId,
    asset: { release: inventory.release, object: item.asset, etag: item.etag, envelope: policy.envelope, maxTransferBytes: policy.maxTransferBytes },
    approval: policy.approvalSha256, projection: policy.projectionSha256, classifier: policy.classifierSha256, regions: policy.regions,
  }));
}

/**
 * Returns {status, ...}. Statuses: attached, checked, refused. Writes only when
 * apply is true and confirmDatabase names the connected database.
 * `upstream` and `reserveAttempt` are injectable so tests never touch a network.
 */
async function attach({ db, inventory, policy, scanId, upstream, reserveAttempt, apply = false, confirmDatabase = '', selfHash = '000000000000' }) {
  const refuse = (reason, extra = {}) => ({ status: 'refused', reason, ...extra });
  if (!inventory || !Array.isArray(inventory.items) || digest(JSON.stringify(inventory.items)) !== inventory.inventorySha256) return refuse('inventory digest mismatch');
  const items = inventory.items.filter((entry) => entry?.id === policy?.itemId);
  if (items.length !== 1) return refuse('item not found in inventory');
  const item = items[0];
  const match = REMOTE_ASSET.exec(item.asset ?? '');
  if (!match || match[1] !== inventory.release) return refuse('asset is not a pinned release object');
  if (recomputeScanId(inventory, item, policy) !== scanId) return refuse('recomputed scan id does not match');
  const completed = await db.query('SELECT 1 FROM directory_overture_private_completion WHERE "scanId"=$1', [scanId]);
  if (!completed.length) return refuse('no completed scan with that id');
  const existing = await db.query('SELECT 1 FROM directory_overture_source_evidence WHERE "scanId"=$1', [scanId]);
  if (existing.length) return refuse('evidence already recorded; it is insert-only');

  const { openPinnedRangeProxy } = await import('./overture-range-proxy.mjs');
  const proxy = await openPinnedRangeProxy({ asset: item.asset, etag: item.etag, maxBytes: 1, reserveAttempt, upstream, requestTimeoutMs: 30000 });
  let status;
  try { status = (await fetch(proxy.url, { method: 'HEAD' })).status; } finally { await proxy.close(); }
  if (status === 412) return refuse('object was replaced upstream (412); nothing attached');
  const captured = proxy.evidence();
  if (status !== 200 || !captured || captured.etag !== item.etag || captured.asset !== item.asset) return refuse('upstream did not confirm the pinned ETag', { httpStatus: status });
  const modified = captured.lastModified ? new Date(captured.lastModified) : null;
  if (!modified || Number.isNaN(modified.getTime())) return refuse('upstream sent no usable Last-Modified');
  const inventoryModified = item.lastModified ? new Date(item.lastModified) : null;
  if (!inventoryModified || inventoryModified.getTime() !== modified.getTime()) {
    return refuse('Last-Modified differs from the checked-in inventory', { upstream: modified.toISOString(), inventory: inventoryModified ? inventoryModified.toISOString() : null });
  }
  const report = { scanId, releaseId: inventory.release, upstreamLastModified: modified.toISOString(), artifactEtag: item.etag };
  if (!apply) return { status: 'checked', ...report };
  const current = (await db.query('SELECT current_database() AS name'))[0].name;
  if (!confirmDatabase || confirmDatabase !== current) return refuse('--confirm-database does not match the connected database', { connected: current });
  const written = await db.transaction((manager) => insertSourceEvidence(manager, scanId, {
    kind: 'attached_verified', releaseId: inventory.release, artifactUrl: item.asset, artifactEtag: item.etag,
    artifactBytes: captured.contentRangeTotal ?? item.size ?? null, upstreamLastModified: modified, observedAt: null,
    recorder: `attach:local-directory-source-freshness-attach.cjs@${selfHash}`, inventorySha256: inventory.inventorySha256,
  }));
  return { status: written ? 'attached' : 'refused', ...report };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ''; };
  const apply = args.includes('--apply');
  const inventory = JSON.parse(fs.readFileSync(value('--inventory'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(value('--policy'), 'utf8'));
  const scanId = value('--scan');
  const url = new URL(process.env.DIRECTORY_DATABASE_URL || '');
  const budgetUrl = new URL(process.env.DIRECTORY_BUDGET_DATABASE_URL || process.env.DIRECTORY_DATABASE_URL || '');
  const db = new DataSource({ type: 'postgres', url: url.href });
  const budget = new DataSource({ type: 'postgres', url: budgetUrl.href });
  await db.initialize(); await budget.initialize();
  try {
    const { authorizeAnonymousOvertureAttempt } = require('../apps/directory/src/provider-budget');
    const item = inventory.items.find((entry) => entry.id === policy.itemId);
    const keys = crypto.generateKeyPairSync('ed25519'), subject = crypto.randomUUID();
    const reserveAttempt = (attempt) => {
      const now = Date.now();
      const claims = { version: 's4-private-source-v1', policyId: policy.approvalSha256, subject, assetSha256: digest(item.asset), etag: item.etag, methods: ['HEAD'], maxCostCents: 1, issuedAt: now - 1000, expiresAt: now + 600000 };
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const signature = crypto.sign(null, Buffer.from(payload), keys.privateKey).toString('base64url');
      return authorizeAnonymousOvertureAttempt(budget, keys.publicKey, { payload, signature }, attempt);
    };
    const selfHash = digest(fs.readFileSync(__filename)).slice(0, 12);
    const result = await attach({ db, inventory, policy, scanId, reserveAttempt, apply, confirmDatabase: value('--confirm-database'), selfHash });
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'refused') process.exitCode = 2;
  } finally { await db.destroy(); await budget.destroy(); }
}

module.exports = { attach, recomputeScanId };
if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
