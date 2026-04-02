import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadContactMetadata2026040100000
  implements MigrationInterface
{
  name = 'AddLeadContactMetadata2026040100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "originalPostingUrl" character varying`
    );
    await queryRunner.query(`ALTER TABLE "leads" ADD "contacts" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "contacts"`);
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "originalPostingUrl"`
    );
  }
}
