import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreCatalog1787432181448 implements MigrationInterface {
  name = 'AddStoreCatalog1787432181448';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_6a5f9c72b2e7c525e1c06ba6308"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_a1b2c3d4e5f6g7h8i9j0k1l2m3n4"`
    );
    await queryRunner.query(
      `ALTER TABLE "availabilities" DROP CONSTRAINT "FK_b2c3d4e5f6g7h8i9j0k1l2m3n4o5"`
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_96249fef9ab22c3a7f5b6c8d7c0"`
    );
    await queryRunner.query(
      `CREATE TABLE "store_catalogs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "description" text, "ownerId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "appScope" character varying(128) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f2d6f398fd11077baae1d1ada07" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7f38fa969580640e2b08245108" ON "store_catalogs" ("ownerId", "workspaceId", "appScope", "name") `
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "catalogId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_4cd72dc0100406118fa8cf8cfeb" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_9b623fcf3c04296ffbdf658bc31" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "availabilities" ADD CONSTRAINT "FK_cf8db34d95ccd0d9fdc10bfed09" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_c38619b9c5659db0a6cef729b38" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_c38619b9c5659db0a6cef729b38"`
    );
    await queryRunner.query(
      `ALTER TABLE "availabilities" DROP CONSTRAINT "FK_cf8db34d95ccd0d9fdc10bfed09"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_9b623fcf3c04296ffbdf658bc31"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_4cd72dc0100406118fa8cf8cfeb"`
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "catalogId"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f38fa969580640e2b08245108"`
    );
    await queryRunner.query(`DROP TABLE "store_catalogs"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_96249fef9ab22c3a7f5b6c8d7c0" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "availabilities" ADD CONSTRAINT "FK_b2c3d4e5f6g7h8i9j0k1l2m3n4o5" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_a1b2c3d4e5f6g7h8i9j0k1l2m3n4" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_6a5f9c72b2e7c525e1c06ba6308" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
