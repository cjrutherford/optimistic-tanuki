import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecoveryIdentity1793840749883 implements MigrationInterface {
  name = 'RecoveryIdentity1793840749883';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" ADD "sourceEpoch" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" ADD "eventNonce" uuid NOT NULL DEFAULT gen_random_uuid()`
    );
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" ADD CONSTRAINT "UQ_d93ef2e9f92bd002a01bb798ad6" UNIQUE ("eventNonce")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" DROP CONSTRAINT "UQ_d93ef2e9f92bd002a01bb798ad6"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" DROP COLUMN "eventNonce"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_directory_change" DROP COLUMN "sourceEpoch"`
    );
  }
}
