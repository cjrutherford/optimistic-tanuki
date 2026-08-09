import { IndexClassifiedUserId20260809110000 } from './20260809110000-index-classified-user-id';

describe('IndexClassifiedUserId20260809110000', () => {
  it('creates and removes the user-id index idempotently', async () => {
    const queryRunner = { query: jest.fn() };
    const migration = new IndexClassifiedUserId20260809110000();

    await migration.up(queryRunner as never);
    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'CREATE INDEX IF NOT EXISTS "IDX_classified_ad_user_id" ON "classified_ad" ("userId")'
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'DROP INDEX IF EXISTS "IDX_classified_ad_user_id"'
    );
  });
});
