import {
  ACCOUNT_EXPORT_COVERAGE_INVENTORY,
  ACCOUNT_EXPORT_COVERAGE_VERSION,
  evaluateAccountExportCompleteness,
  type AccountExportParticipantSnapshot,
} from './account-export.contract';

describe('account export coverage contract', () => {
  const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';

  it('keeps the known participant inventory explicitly unaccepted', () => {
    expect(ACCOUNT_EXPORT_COVERAGE_VERSION).toBeDefined();
    expect(ACCOUNT_EXPORT_COVERAGE_INVENTORY.accepted).toBe(false);
    expect(ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants).toContain(
      'authentication'
    );
    expect(ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants).toContain('assets');
    expect(ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants).toContain(
      'compliance-audit'
    );
    expect(ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants).toEqual(
      expect.arrayContaining([
        'billing',
        'lead-tracker',
        'learning-service',
        'system-configurator-api',
        'telos-docs-service',
      ])
    );
  });

  it('fails closed for missing, partial, unknown, duplicate, or unaccepted coverage', () => {
    const completeSnapshot = (
      participantId: string
    ): AccountExportParticipantSnapshot<Record<string, never>> => ({
      contractVersion: 1,
      participantId,
      accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
      status: 'complete',
      uncovered: [],
      data: {},
    });

    const result = evaluateAccountExportCompleteness(
      [
        completeSnapshot('authentication'),
        completeSnapshot('profile'),
        completeSnapshot('unexpected-service'),
        completeSnapshot('profile'),
        {
          ...completeSnapshot('assets'),
          status: 'partial',
          uncovered: ['media bytes'],
        },
      ],
      ACCOUNT_ID
    );

    expect(result.complete).toBe(false);
    expect(result.status).toBe('EXPORT_INCOMPLETE');
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'coverage-inventory-unaccepted',
        'missing-participant:permissions',
        'duplicate-participant:profile',
        'unknown-participant:unexpected-service',
        'partial-participant:assets',
      ])
    );
  });

  it('fails closed when a participant reports a service failure', () => {
    const failed: AccountExportParticipantSnapshot<Record<string, never>> = {
      contractVersion: 1,
      participantId: 'profile',
      accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
      status: 'failed',
      uncovered: ['snapshot unavailable'],
      data: {},
    };

    const result = evaluateAccountExportCompleteness([failed], ACCOUNT_ID);

    expect(result.complete).toBe(false);
    expect(result.blockers).toContain('failed-participant:profile');
    expect(result.blockers).toContain('missing-participant:authentication');
  });

  it('marks invalid participant statuses as blockers', () => {
    const invalid = evaluateAccountExportCompleteness(
      [
        {
          contractVersion: 1,
          participantId: 'authentication',
          accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
          status: 'successful' as 'complete',
          uncovered: [],
          data: {},
        },
      ],
      ACCOUNT_ID
    );

    expect(invalid.blockers).toContain(
      'invalid-participant-status:authentication'
    );
  });

  it('fails closed for participant snapshots from another account or contract version', () => {
    const result = evaluateAccountExportCompleteness(
      [
        {
          contractVersion: 2 as 1,
          participantId: 'authentication',
          accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
          status: 'complete',
          uncovered: [],
          data: {},
        },
        {
          contractVersion: 1,
          participantId: 'profile',
          accountId: 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d',
          status: 'complete',
          uncovered: [],
          data: {},
        },
      ],
      ACCOUNT_ID
    );

    expect(result.complete).toBe(false);
    expect(result.blockers).toContain(
      'invalid-contract-version:authentication'
    );
    expect(result.blockers).toContain('account-id-mismatch:profile');
  });
});
