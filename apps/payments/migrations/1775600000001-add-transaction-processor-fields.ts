import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionProcessorFields1775600000001
    implements MigrationInterface {
    name = 'AddTransactionProcessorFields1775600000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD "externalProvider" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD "externalTransactionId" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD "externalCustomerId" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ADD "externalInvoiceId" character varying`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP COLUMN "externalInvoiceId"`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP COLUMN "externalCustomerId"`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP COLUMN "externalTransactionId"`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP COLUMN "externalProvider"`
        );
    }
}
