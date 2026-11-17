import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1793843071941 implements MigrationInterface {
  name = 'DirectoryFoundation1793843071941';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" ADD "eventNonce" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" ADD "sourceEpoch" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" ADD "recoveryEpoch" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" DROP COLUMN "recoveryEpoch"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" DROP COLUMN "sourceEpoch"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_reconciliation_receipt" DROP COLUMN "eventNonce"`
    );
  }
}
