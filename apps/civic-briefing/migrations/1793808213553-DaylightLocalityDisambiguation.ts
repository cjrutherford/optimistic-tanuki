import { MigrationInterface, QueryRunner } from 'typeorm';

export class DaylightLocalityDisambiguation1793808213553
  implements MigrationInterface
{
  name = 'DaylightLocalityDisambiguation1793808213553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "localities" ADD "excludePhrases" text`
    );
    await queryRunner.query(`ALTER TABLE "localities" ADD "officials" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "officials"`);
    await queryRunner.query(
      `ALTER TABLE "localities" DROP COLUMN "excludePhrases"`
    );
  }
}
