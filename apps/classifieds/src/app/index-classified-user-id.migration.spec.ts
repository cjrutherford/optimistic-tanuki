import { IndexClassifiedUserId1786715231836 } from '../../migrations/1786715231836-index-classified-user-id';

describe('IndexClassifiedUserId1786715231836', () => {
  it('creates and removes the generated user-id index', async () => {
    const queryRunner = { query: jest.fn() };
    const migration = new IndexClassifiedUserId1786715231836();

    await migration.up(queryRunner as never);
    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      `SELECT 1 FROM "migrations" WHERE "name" = 'IndexClassifiedUserId20260809110000' LIMIT 1`
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'CREATE INDEX "IDX_d3bc8e109cd196fa6a453237b9" ON "classified_ad" ("userId") '
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      `SELECT 1 FROM "migrations" WHERE "name" = 'IndexClassifiedUserId20260809110000' LIMIT 1`
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      4,
      'DROP INDEX "public"."IDX_d3bc8e109cd196fa6a453237b9"'
    );
  });

  it('does not create a second index after the retired migration was recorded', async () => {
    const queryRunner = {
      query: jest.fn(async () => [{ exists: true }]),
    };
    const migration = new IndexClassifiedUserId1786715231836();

    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('does not remove the retired index when reverting after legacy history', async () => {
    const queryRunner = {
      query: jest.fn(async () => [{ exists: true }]),
    };
    const migration = new IndexClassifiedUserId1786715231836();

    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });
});
