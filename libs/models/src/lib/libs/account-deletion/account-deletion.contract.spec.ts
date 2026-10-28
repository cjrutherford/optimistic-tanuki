import {
  ACCOUNT_DELETION_CONTRACT_VERSION,
  DELETED_ACCOUNT_ID,
  deletedAccountPlaceholder,
  isDeletedAccountIdentity,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
  type AccountDeletionGrant,
} from './account-deletion.contract';

const validGrant: AccountDeletionGrant = {
  contractVersion: ACCOUNT_DELETION_CONTRACT_VERSION,
  operationId: '123e4567-e89b-42d3-a456-426614174000',
  accountId: '223e4567-e89b-42d3-a456-426614174000',
  appId: 'client-interface',
  owner: 'profile',
  action: 'erase',
  attempt: 1,
  leaseOwner: '323e4567-e89b-42d3-a456-426614174000',
  expiresAt: '2026-10-24T12:30:00.000Z',
  signature: 'a'.repeat(64),
};

describe('account deletion contract', () => {
  it('recognizes the distinct finalize capability shape without accepting unknown actions', () => {
    expect(
      validateDeletionGrantShape({ ...validGrant, action: 'finalize' })
    ).toBe(true);
    expect(
      validateDeletionGrantShape({ ...validGrant, action: 'finish' })
    ).toBe(false);
  });
  it('accepts a well-shaped grant without comparing expiry to wall clock', () => {
    expect(validateDeletionGrantShape(validGrant)).toBe(true);
  });

  it.each([
    { ...validGrant, appId: 'forgeofwill' },
    { ...validGrant, accountId: DELETED_ACCOUNT_ID },
    { ...validGrant, operationId: DELETED_ACCOUNT_ID },
    { ...validGrant, extra: 'not allowed' },
    { ...validGrant, expiresAt: '2026-02-30T12:30:00.000Z' },
    { ...validGrant, expiresAt: '2026-10-24 12:30:00Z' },
  ])('rejects invalid grant fields', (grant) => {
    expect(validateDeletionGrantShape(grant)).toBe(false);
  });

  it('keeps current UUID profiles and legacy keys in distinct bounded domains', () => {
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: ['423e4567-e89b-42d3-a456-426614174000'],
        legacyProfileIds: ['legacy:profile:one'],
      })
    ).toBe(true);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: ['not-a-uuid'],
        legacyProfileIds: [],
      })
    ).toBe(false);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: [],
        legacyProfileIds: [''],
      })
    ).toBe(false);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: ['423e4567-e89b-42d3-a456-426614174000'],
        legacyProfileIds: ['423e4567-e89b-42d3-a456-426614174000'],
      })
    ).toBe(true);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: [],
        legacyProfileIds: ['x'.repeat(513)],
      })
    ).toBe(false);
  });

  it('rejects noncanonical and ambiguous identity inputs', () => {
    expect(
      validateDeletionGrantShape({
        ...validGrant,
        accountId: validGrant.accountId.toUpperCase(),
      })
    ).toBe(false);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: [],
        legacyProfileIds: [' legacy '],
      })
    ).toBe(false);
    expect(
      validateDeletionIdentityDomains({
        currentProfileIds: [
          '423e4567-e89b-42d3-a456-426614174000',
          '423E4567-E89B-42D3-A456-426614174000',
        ],
        legacyProfileIds: [],
      })
    ).toBe(false);
  });

  it('projects an immutable placeholder without identity values and recognizes only the sentinel string', () => {
    const placeholder = deletedAccountPlaceholder();
    expect(Object.isFrozen(placeholder)).toBe(true);
    expect(placeholder).toEqual({
      kind: 'deleted-account',
      label: 'Deleted account',
      profileId: null,
      userId: null,
      avatarUrl: null,
    });
    expect(isDeletedAccountIdentity(DELETED_ACCOUNT_ID)).toBe(true);
    expect(isDeletedAccountIdentity({ userId: DELETED_ACCOUNT_ID })).toBe(
      false
    );
    expect(isDeletedAccountIdentity(null)).toBe(false);
  });
});
