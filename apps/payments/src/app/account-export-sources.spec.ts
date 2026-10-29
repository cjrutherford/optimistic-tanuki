import { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createPaymentsAccountExportSources } from './account-export-sources';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entity = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const time = '2026-02-03 04:05:06.123456+00';

it('uses the shared ordered registry and bounded parameterized keyset queries', () => {
  const sources = createPaymentsAccountExportSources('captured_identities');
  expect(sources.map((source) => source.source)).toEqual(
    PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES
  );
  for (const source of sources.slice(0, -1)) {
    expect(source.sql).toContain('$1::uuid');
    expect(source.sql).toContain('$2::text');
    expect(source.sql).toContain('ORDER BY r.id::text COLLATE "C" LIMIT $3');
  }
  expect(sources[9].sql).toContain('$1::uuid');
  expect(sources[0].sql).toContain('captured_identities');
  expect(sources[7].sql).toContain('subjectBindingValid');
  expect(sources[9].sql).toContain('AND FALSE)');
  expect(sources[1].sql).not.toContain('interestedBuyerId');
  expect(sources[1].sql).not.toContain('proofImageUrl');
  expect(sources[1].sql).not.toContain('disputeReason');
  expect(sources[2].sql).not.toContain('payoutEmail');
  expect(sources[5].sql).not.toContain('bankAccountLast4');
  expect(sources[6].sql).not.toContain('description');
  expect(sources[7].sql).not.toContain('customCss');
  expect(sources[8].sql).not.toContain('adContent');
  expect(sources[3].sql).not.toContain('financeTransactionId');
});

it('projects exact decimals, microsecond timestamps, and explicit provenance for account receipts', () => {
  const sources = createPaymentsAccountExportSources('identities');
  const donation = sources[0].project(
    {
      id: entity,
      userId: account,
      profileId: other,
      profileBindingValid: true,
      amount: '12.30',
      isRecurring: false,
      status: 'completed',
      currency: 'USD',
      createdAt: time,
      cancelledAt: null,
    },
    account
  );
  expect(donation['amount']).toBe('12.30');
  expect(donation['createdAt']).toBe('2026-02-03T04:05:06.123456Z');
  expect(donation['attribution']).toBe('recorded-unverified');
  expect(donation['consent']).toBe('not-inferred');
  const payment = sources[1].project(
    {
      id: entity,
      buyerId: account,
      sellerId: other,
      classifiedId: entity,
      amount: '12345678.90',
      offerId: null,
      paymentIntentId: 'opaque-payment-ref',
      status: 'released',
      createdAt: time,
      confirmedAt: null,
      releasedAt: null,
    },
    account
  );
  expect(payment['relationship']).toEqual(['buyer']);
  expect(payment).not.toHaveProperty('paymentReference');
  expect(sources[1].sql).not.toContain('paymentIntentId');
  expect(JSON.stringify(payment)).not.toContain('opaque-payment-ref');
  expect(payment).not.toHaveProperty('sellerId');
  const wallet = sources[2].project(
    {
      id: entity,
      sellerId: account,
      availableBalance: '0.00',
      pendingBalance: '22.10',
      totalEarned: '22.10',
      totalPaidOut: '0.00',
      createdAt: time,
      lastPayoutAt: null,
    },
    account
  );
  expect(wallet['pendingBalance']).toBe('22.10');
});

it('fails closed for unbound donation profiles, foreign subjects, invalid amounts and theme ownership', () => {
  const sources = createPaymentsAccountExportSources('identities');
  expect(() =>
    sources[0].project(
      {
        id: entity,
        userId: account,
        profileId: other,
        profileBindingValid: false,
        amount: '1.00',
        isRecurring: false,
        status: 'pending',
        currency: 'USD',
        createdAt: time,
        cancelledAt: null,
      },
      account
    )
  ).toThrow('PAYMENTS_EXPORT_PROFILE_BINDING_UNVERIFIED');
  expect(() =>
    sources[2].project(
      {
        id: entity,
        sellerId: other,
        availableBalance: '1.00',
        pendingBalance: '0.00',
        totalEarned: '1.00',
        totalPaidOut: '0.00',
        createdAt: time,
        lastPayoutAt: null,
      },
      account
    )
  ).toThrow('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
  expect(() =>
    sources[2].project(
      {
        id: entity,
        sellerId: account,
        availableBalance: 1,
        pendingBalance: '0.00',
        totalEarned: '1.00',
        totalPaidOut: '0.00',
        createdAt: time,
        lastPayoutAt: null,
      },
      account
    )
  ).toThrow('PAYMENTS_EXPORT_INVALID_DECIMAL');
  expect(() =>
    sources[7].project(
      {
        id: entity,
        businessPageId: other,
        subjectBindingValid: false,
        createdAt: time,
        updatedAt: time,
      },
      account
    )
  ).toThrow('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
  expect(() => createPaymentsAccountExportSources('x";DROP')).toThrow(
    'PAYMENTS_EXPORT_INVALID_PROFILE_TABLE'
  );
});
