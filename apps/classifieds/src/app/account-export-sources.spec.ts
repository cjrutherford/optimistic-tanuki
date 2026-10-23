import { createClassifiedsAccountExportSources } from './account-export-sources';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const base = () => ({
  id,
  title: 'Desk',
  description: 'Used desk',
  price: '19.90',
  currency: 'USD',
  category: null,
  condition: null,
  status: 'active',
  communityId: null,
  profileId: profile,
  userId: account,
  appScope: 'local-hub',
  isFeatured: false,
  featuredUntil: null,
  createdAt: '2026-01-01 12:00:00.123456+00',
  updatedAt: '2026-01-01T12:00:00Z',
  expiresAt: null,
  profileBindingValid: true,
});

it('selects only the two approved scopes and uses parameterized keyset paging', () => {
  const source = createClassifiedsAccountExportSources('profile_scope')[0];
  expect(source.sql).toContain('r."userId"=$1::uuid');
  expect(source.sql).toContain("IN ('client-interface','local-hub')");
  expect(source.sql).toContain('ORDER BY r.id::text COLLATE "C" LIMIT $3');
  expect(source.sql).not.toContain('imageUrls');
});

it('projects bounded decimal values, canonical microsecond timestamps and explicit policy', () => {
  const result = createClassifiedsAccountExportSources('p')[0].project(
    base(),
    account
  );
  expect(result['price']).toBe('19.90');
  expect(result['createdAt']).toBe('2026-01-01T12:00:00.123456Z');
  expect(result['mediaDisposition']).toBe(
    'excluded-unverified-image-references'
  );
  expect(result['attribution']).toBe('recorded-unverified');
  expect(result['consent']).toBe('not-inferred');
});

it('fails closed on unbound profiles, foreign scopes, malformed scalar values and bounds', () => {
  const project = createClassifiedsAccountExportSources('p')[0].project;
  expect(() =>
    project({ ...base(), profileBindingValid: false }, account)
  ).toThrow('CLASSIFIEDS_EXPORT_PROFILE_BINDING_UNVERIFIED');
  expect(() => project({ ...base(), appScope: 'social' }, account)).toThrow(
    'CLASSIFIEDS_EXPORT_UNKNOWN_ENUM'
  );
  expect(() =>
    project({ ...base(), price: 9007199254740991 }, account)
  ).toThrow('CLASSIFIEDS_EXPORT_INVALID_PRICE');
  expect(() => project({ ...base(), isFeatured: 'false' }, account)).toThrow(
    'CLASSIFIEDS_EXPORT_INVALID_BOOLEAN'
  );
  expect(() => project({ ...base(), title: 'x'.repeat(256) }, account)).toThrow(
    'CLASSIFIEDS_EXPORT_INVALID_TEXT'
  );
  expect(() =>
    project({ ...base(), description: 'x'.repeat(65537) }, account)
  ).toThrow('CLASSIFIEDS_EXPORT_INVALID_TEXT');
});

it('rejects unsafe profile identifiers and malformed UUIDs', () => {
  expect(() =>
    createClassifiedsAccountExportSources('x"; DROP TABLE classified_ad')
  ).toThrow('CLASSIFIEDS_EXPORT_INVALID_PROFILE_TABLE');
  expect(() =>
    createClassifiedsAccountExportSources('p')[0].project(
      { ...base(), id: 'bad' },
      account
    )
  ).toThrow('CLASSIFIEDS_EXPORT_INVALID_ID');
});
