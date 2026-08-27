import { AddRelease1768774571173 } from './migrations/1768774571173-add-release';

describe('AddRelease1768774571173', () => {
  it('adds the release column with an empty JSON object default', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AddRelease1768774571173();

    await migration.up({ query } as any);

    expect(query).toHaveBeenCalledWith(
      `ALTER TABLE "app_configuration_entity" ADD "release" jsonb NOT NULL DEFAULT '{}'`
    );
  });
});
