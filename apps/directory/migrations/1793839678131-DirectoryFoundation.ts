import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793839678131 implements MigrationInterface {
    name = 'DirectoryFoundation1793839678131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" DROP CONSTRAINT "FK_ef6a9346999af83988c3d9db957"`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ALTER COLUMN "slotId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ADD CONSTRAINT "FK_ef6a9346999af83988c3d9db957" FOREIGN KEY ("slotId") REFERENCES "directory_receipt_slot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" DROP CONSTRAINT "FK_ef6a9346999af83988c3d9db957"`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ALTER COLUMN "slotId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_reconciliation_receipt" ADD CONSTRAINT "FK_ef6a9346999af83988c3d9db957" FOREIGN KEY ("slotId") REFERENCES "directory_receipt_slot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
