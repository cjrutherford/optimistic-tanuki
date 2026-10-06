import {
  defaultPublicationLockPath,
  publicationLockPathFor,
} from '../../src/publication.js';

describe('publication lock scope', () => {
  it.todo(
    'locks beside a SQLite database file so runs on separate databases do not wait on each other — SQLite-only, removed with D16'
  );

  it('falls back to the global lock for in-memory and non-SQLite databases', () => {
    expect(
      publicationLockPathFor({ type: 'postgres', database: 'civic' })
    ).toBe(defaultPublicationLockPath());
    expect(publicationLockPathFor(undefined)).toBe(
      defaultPublicationLockPath()
    );
  });
});
