import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierOfferSourceChannel1790594261336
  implements MigrationInterface
{
  name = 'AddSupplierOfferSourceChannel1790594261336';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sc_supplier_offers" ADD "sourceChannel" character varying(16) NOT NULL DEFAULT 'file-import'`
    );
    await queryRunner.query(
      `ALTER TABLE "sc_supplier_offers" ADD CONSTRAINT "CHK_sc_supplier_offers_source_channel" CHECK ("sourceChannel" IN ('live-api', 'file-import'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sc_supplier_offers" DROP CONSTRAINT "CHK_sc_supplier_offers_source_channel"`
    );
    await queryRunner.query(
      `ALTER TABLE "sc_supplier_offers" DROP COLUMN "sourceChannel"`
    );
  }
}
