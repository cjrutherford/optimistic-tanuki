import { AddRelease1768774571173 } from './migrations/1768774571173-add-release';

describe('AddRelease1768774571173', () => {
  it('adds the release column with an empty JSON object default', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AddRelease1768774571173();

    await migration.up({ query } as any);

    expect(query).toHaveBeenCalledWith(
      `ALTER TABLE "app_configuration_entity" ADD COLUMN IF NOT EXISTS "release" jsonb NOT NULL DEFAULT '{}'`
    );
  });

  it('does not fail where the column is already present', async () => {
    // The reason for IF NOT EXISTS, kept as an assertion rather than a
    // comment: this column reached some databases without the migration
    // being recorded, and the bare ALTER then failed with 42701. Because
    // setup-and-migrate runs under `set -e`, that took down the whole loop
    // and every app after this one silently went unmigrated.
    const query = jest.fn().mockResolvedValue(undefined);

    await new AddRelease1768774571173().up({ query } as any);

    expect(query.mock.calls[0][0]).toContain('IF NOT EXISTS');
  });
});
