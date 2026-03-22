import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityImageTimezone1774000000000 implements MigrationInterface {
  name = 'CommunityImageTimezone1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" ADD "imageUrl" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "community" ADD "timezone" character varying(100)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" DROP COLUMN "timezone"`
    );
    await queryRunner.query(
      `ALTER TABLE "community" DROP COLUMN "imageUrl"`
    );
  }
}
