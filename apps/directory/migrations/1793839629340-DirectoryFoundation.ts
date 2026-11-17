import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793839629340 implements MigrationInterface {
    name = 'DirectoryFoundation1793839629340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_receipt_slot" ("id" integer NOT NULL, CONSTRAINT "PK_4f705f5989ef9539486d8bd5050" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ADD "slotId" integer`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ADD CONSTRAINT "UQ_ef6a9346999af83988c3d9db957" UNIQUE ("slotId")`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ADD CONSTRAINT "FK_ef6a9346999af83988c3d9db957" FOREIGN KEY ("slotId") REFERENCES "directory_receipt_slot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" DROP CONSTRAINT "FK_ef6a9346999af83988c3d9db957"`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" DROP CONSTRAINT "UQ_ef6a9346999af83988c3d9db957"`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" DROP COLUMN "slotId"`);
        await queryRunner.query(`DROP TABLE "directory_receipt_slot"`);
    }

}
