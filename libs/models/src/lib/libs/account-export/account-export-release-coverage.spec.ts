import {
  ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
  ACCOUNT_EXPORT_RELEASE_OWNERS,
  AccountExportReleaseCaptureMetadata,
  evaluateAccountExportReleaseCoverage,
} from './account-export-release-coverage';

const accountId = '10000000-0000-4000-8000-000000000001';
const captureId = '20000000-0000-4000-8000-000000000001';
const sourcesByOwner: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    ACCOUNT_EXPORT_RELEASE_OWNERS.map((owner) => [owner, [`${owner}-records`]])
  );
const metadata = (): AccountExportReleaseCaptureMetadata[] =>
  ACCOUNT_EXPORT_RELEASE_OWNERS.map((participantId) => ({
    participantId,
    accountId,
    captureId,
    snapshotAt: '2026-10-24T12:00:00.000Z',
    sizeBytes: 128,
    sha256: 'a'.repeat(64),
    rowCount: 2,
    sourceRowCounts: { [`${participantId}-records`]: 2 },
    sourceDispositions: {
      [`${participantId}-records`]: 'Exported account-owned records',
    },
  }));
const evaluate = (rows = metadata(), appId = 'client-interface') =>
  evaluateAccountExportReleaseCoverage(appId, accountId, rows, sourcesByOwner);

describe('evaluateAccountExportReleaseCoverage', () => {
  it('validates every required capture while keeping artifact readiness separate', () => {
    expect(evaluate()).toEqual({
      coverageVersion: ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
      complete: true,
      blockers: [],
      artifactReady: false,
    });
  });

  it('accepts precise PostgreSQL transaction timestamps without weakening the timezone requirement', () => {
    const rows = metadata();
    rows[0].snapshotAt = '2026-10-24 12:00:00.123456+00';
    expect(evaluate(rows).complete).toBe(true);
    rows[0].snapshotAt = '2026-10-24 12:00:00';
    expect(evaluate(rows).blockers).toContain(
      'invalid-snapshot-at:authentication'
    );
  });

  it('fails closed for missing, duplicate, foreign, and unknown owner metadata', () => {
    expect(evaluate(metadata().slice(1)).blockers).toContain(
      'missing-owner:authentication'
    );
    expect(evaluate([...metadata(), metadata()[0]]).blockers).toContain(
      'duplicate-owner:authentication'
    );
    const foreign = metadata();
    foreign[0].accountId = '30000000-0000-4000-8000-000000000001';
    expect(evaluate(foreign).blockers).toContain(
      'foreign-account:authentication'
    );
    const unknown = metadata();
    unknown.push({ ...unknown[0], participantId: 'billing' });
    expect(evaluate(unknown).blockers).toContain('unknown-owner:billing');
  });

  it('rejects unsupported apps, invalid identifiers and malformed evidence', () => {
    expect(evaluate(metadata(), 'business-site').blockers).toContain(
      'unsupported-scope'
    );
    const malformed = metadata();
    malformed[0] = {
      ...malformed[0],
      captureId: 'not-a-uuid',
      sha256: 'bad',
      sourceRowCounts: { [`${malformed[0].participantId}-records`]: 1 },
    };
    const result = evaluate(malformed);
    expect(result.blockers).toContain('invalid-capture-id:authentication');
    expect(result.blockers).toContain('invalid-sha256:authentication');
    expect(result.blockers).toContain(
      'source-row-count-total-mismatch:authentication'
    );
  });

  it('rejects missing/extra sources, missing dispositions and an untrusted registry drift', () => {
    const rows = metadata();
    rows[0].sourceRowCounts = { extra: 2 };
    rows[0].sourceDispositions = { extra: 'unexpected' };
    const result = evaluate(rows);
    expect(result.blockers).toContain(
      'invalid-source-row-count:authentication:authentication-records'
    );
    expect(result.blockers).toContain(
      'missing-source-disposition:authentication:authentication-records'
    );
    expect(result.blockers).toContain(
      'extra-source-row-count:authentication:extra'
    );
    expect(result.blockers).toContain(
      'extra-source-disposition:authentication:extra'
    );

    const drifted = { ...sourcesByOwner, rogue: ['rogue-records'] };
    expect(
      evaluateAccountExportReleaseCoverage(
        'local-hub',
        accountId,
        metadata(),
        drifted
      ).blockers
    ).toContain('unknown-source-registry-owner:rogue');
  });

  it('keeps videos required and always reports that capture coverage is not artifact ready', () => {
    expect(ACCOUNT_EXPORT_RELEASE_OWNERS).toContain('videos');
    expect(evaluate().artifactReady).toBe(false);
    expect(
      evaluate(
        metadata().filter(({ participantId }) => participantId !== 'videos')
      ).blockers
    ).toContain('missing-owner:videos');
  });
});
