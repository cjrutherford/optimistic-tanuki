import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexClassifiedUserId20260809110000 implements MigrationInterface {
  name = 'IndexClassifiedUserId20260809110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_classified_ad_user_id" ON "classified_ad" ("userId")'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_classified_ad_user_id"');
  }
}
