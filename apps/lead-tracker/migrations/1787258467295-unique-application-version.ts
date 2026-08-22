import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueApplicationVersion1787258467295
  implements MigrationInterface
{
  name = 'UniqueApplicationVersion1787258467295';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96c53d98d2501ebf5ecfc13ac1"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_96c53d98d2501ebf5ecfc13ac1" ON "lead_applications" ("profileId", "leadId", "version") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96c53d98d2501ebf5ecfc13ac1"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96c53d98d2501ebf5ecfc13ac1" ON "lead_applications" ("leadId", "profileId", "version") `
    );
  }
}
