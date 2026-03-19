import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityParent1773450000000 implements MigrationInterface {
  name = 'CommunityParent1773450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community"
      ADD COLUMN IF NOT EXISTS "parentId" uuid REFERENCES "community"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community" DROP COLUMN IF EXISTS "parentId"
    `);
  }
}
