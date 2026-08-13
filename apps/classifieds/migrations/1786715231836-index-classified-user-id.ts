import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexClassifiedUserId1786715231836 implements MigrationInterface {
  name = 'IndexClassifiedUserId1786715231836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This replacement was generated after the retired migration reached main.
    // Preserve an upgraded database's history without adding a duplicate index.
    const retiredMigration = await queryRunner.query(
      `SELECT 1 FROM "migrations" WHERE "name" = 'IndexClassifiedUserId20260809110000' LIMIT 1`
    );
    if (Array.isArray(retiredMigration) && retiredMigration.length > 0) {
      return;
    }

    await queryRunner.query(
      `CREATE INDEX "IDX_d3bc8e109cd196fa6a453237b9" ON "classified_ad" ("userId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const retiredMigration = await queryRunner.query(
      `SELECT 1 FROM "migrations" WHERE "name" = 'IndexClassifiedUserId20260809110000' LIMIT 1`
    );
    if (Array.isArray(retiredMigration) && retiredMigration.length > 0) {
      return;
    }

    await queryRunner.query(
      `DROP INDEX "public"."IDX_d3bc8e109cd196fa6a453237b9"`
    );
  }
}
