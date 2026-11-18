import { DataSource } from 'typeorm';
import { KeyObject } from 'node:crypto';
import { createHash } from 'node:crypto';
import { isPaused, ProviderPausedError } from './operating-controls';
import { isAcquisitionAuthorized } from './acquisition-authorization';
import {
  ProviderAttempt,
  SignedProviderGrant,
  verifyProviderGrant,
} from './provider-policy-authority';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const label = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const MONTHLY_LIMIT_CENTS = 2500;
export type BudgetAttempt = {
  attemptId: string;
  provider: string;
  operation: string;
  maxCostCents: number;
};

/**
 * Local reservation only. A replay is never permission to dispatch again.
 * Every provider attempt, including retries, needs a new ID and an independently
 * established conservative maximum. Reservations are never automatically released.
 */
export async function reserveProviderBudget(
  db: DataSource,
  input: BudgetAttempt,
  authorization?: { policyId: string; revalidate: () => void }
): Promise<{
  state: 'reserved' | 'replay';
  attemptId: string;
  period: string;
  remainingCents: number;
}> {
  if (
    !input ||
    !uuid.test(input.attemptId || '') ||
    !label.test(input.provider || '') ||
    !label.test(input.operation || '')
  )
    throw Error('Invalid budget attempt');
  if (
    !Number.isSafeInteger(input.maxCostCents) ||
    input.maxCostCents < 1 ||
    input.maxCostCents > MONTHLY_LIMIT_CENTS
  )
    throw Error('Known positive maximum cost required');
  const attempt = { ...input };
  return db.transaction(async (manager) => {
    await manager.query("SET LOCAL lock_timeout = '2s'");
    await manager.query("SET LOCAL statement_timeout = '10s'");
    if (authorization) {
      const policy = await manager.query(
        'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',
        [authorization.policyId]
      );
      if (policy.length !== 1 || policy[0].revoked !== false)
        throw Error('Private policy unavailable or revoked');
      authorization.revalidate();
    }
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-provider-budget-v1',0))"
    );
    authorization?.revalidate();
    // Fail closed while an operator has paused provider acquisition; checked under the budget lock.
    if (await isPaused(manager, 'provider_acquisition'))
      throw new ProviderPausedError();
    if (
      (
        await manager.query(
          'SELECT 1 FROM directory_anonymous_overture_attempt WHERE "attemptId"=$1',
          [attempt.attemptId]
        )
      ).length
    )
      throw Error('Budget attempt ID already used');
    const existing = await manager.query(
      'SELECT * FROM directory_provider_budget_attempt WHERE "attemptId"=$1',
      [attempt.attemptId]
    );
    if (existing.length) {
      const row = existing[0];
      if (
        row.provider !== attempt.provider ||
        row.operation !== attempt.operation ||
        row.reservedCents !== attempt.maxCostCents
      )
        throw Error('Budget attempt ID already used');
      const totals = await manager.query(
        'SELECT COALESCE(SUM("reservedCents"),0)::int AS total FROM directory_provider_budget_attempt WHERE period=$1',
        [row.period]
      );
      return {
        state: 'replay' as const,
        attemptId: attempt.attemptId,
        period: row.period,
        remainingCents: Math.max(0, MONTHLY_LIMIT_CENTS - totals[0].total),
      };
    }
    const [{ period }] = await manager.query(
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM') AS period`
    );
    if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period))
      throw Error('Budget period unavailable');
    const [{ total }] = await manager.query(
      'SELECT COALESCE(SUM("reservedCents"),0)::int AS total FROM directory_provider_budget_attempt WHERE period=$1',
      [period]
    );
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      total + attempt.maxCostCents > MONTHLY_LIMIT_CENTS
    )
      throw Error('Monthly provider budget exhausted');
    await manager.query(
      'INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents") VALUES ($1,$2,$3,$4,$5)',
      [
        attempt.attemptId,
        period,
        attempt.provider,
        attempt.operation,
        attempt.maxCostCents,
      ]
    );
    return {
      state: 'reserved' as const,
      attemptId: attempt.attemptId,
      period,
      remainingCents: MONTHLY_LIMIT_CENTS - total - attempt.maxCostCents,
    };
  });
}

/** Private prototype: the signer and key must be provisioned independently of callers. */
export function createBudgetedProviderAttempts(
  db: DataSource,
  publicKey: KeyObject | string | Buffer,
  token: SignedProviderGrant,
  policyId: string
) {
  const signedToken = Object.freeze({ ...token });
  return (attempt: ProviderAttempt) => {
    const request = Object.freeze({ ...attempt });
    const grant = verifyProviderGrant(publicKey, signedToken, request);
    if (grant.policyId !== policyId) throw Error('Grant policy mismatch');
    return reserveProviderBudget(
      db,
      {
        attemptId: request.attemptId,
        provider: 'overture',
        operation: `range.${request.method.toLowerCase()}`,
        maxCostCents: grant.maxCostCents,
      },
      {
        policyId,
        revalidate: () => {
          verifyProviderGrant(publicKey, signedToken, request);
        },
      }
    );
  };
}

/** Local-only receipt for anonymous HTTPS reads of the public Overture S3 bucket. */
export async function authorizeAnonymousOvertureAttempt(
  db: DataSource,
  publicKey: KeyObject | string | Buffer,
  token: SignedProviderGrant,
  attempt: ProviderAttempt,
  options: { automatic?: boolean } = {}
): Promise<{ state: 'authorized-free'; attemptId: string; period: string }> {
  // Operator-local scripts opt in with DIRECTORY_LOCAL_EVALUATION; the worker's automatic sweep is allowed only while
  // Overture is an authorised provider (owner decision D1). The kill switch and policy row are checked below either way.
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' &&
    !(options.automatic === true && isAcquisitionAuthorized('overture'))
  )
    throw Error('Local evaluation is not enabled');
  const signedToken = Object.freeze({ ...token }),
    request = Object.freeze({ ...attempt });
  const grant = verifyProviderGrant(publicKey, signedToken, request);
  let url: URL;
  try {
    url = new URL(request.asset);
  } catch {
    throw Error('Invalid anonymous asset');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/release\/\d{4}-\d{2}-\d{2}\.\d+\/theme=places\/type=place\/[^/]+\.parquet$/.test(
      url.pathname
    )
  )
    throw Error('Invalid anonymous asset');
  return db.transaction(async (manager) => {
    await manager.query("SET LOCAL lock_timeout = '2s'");
    await manager.query("SET LOCAL statement_timeout = '10s'");
    const rows = await manager.query(
      'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',
      [grant.policyId]
    );
    if (rows.length !== 1 || rows[0].revoked !== false)
      throw Error('Private policy unavailable or revoked');
    verifyProviderGrant(publicKey, signedToken, request);
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-provider-budget-v1',0))"
    );
    verifyProviderGrant(publicKey, signedToken, request);
    if (await isPaused(manager, 'provider_acquisition'))
      throw new ProviderPausedError();
    if (
      (
        await manager.query(
          'SELECT 1 FROM directory_provider_budget_attempt WHERE "attemptId"=$1',
          [request.attemptId]
        )
      ).length
    )
      throw Error('Anonymous attempt replay');
    const [{ period }] = await manager.query(
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM') AS period`
    );
    const inserted = await manager.query(
      'INSERT INTO directory_anonymous_overture_attempt ("attemptId",period,"policyId","assetSha256",method) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING "attemptId"',
      [
        request.attemptId,
        period,
        grant.policyId,
        createHash('sha256').update(request.asset).digest('hex'),
        request.method,
      ]
    );
    if (inserted.length !== 1) throw Error('Anonymous attempt replay');
    return {
      state: 'authorized-free' as const,
      attemptId: request.attemptId,
      period,
    };
  });
}
