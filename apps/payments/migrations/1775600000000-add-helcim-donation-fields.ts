import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHelcimDonationFields1775600000000
    implements MigrationInterface {
    name = 'AddHelcimDonationFields1775600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "externalProvider" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "externalTransactionId" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "externalCustomerId" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "externalInvoiceId" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "checkoutToken" character varying`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "checkoutSecretToken" character varying`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "checkoutSecretToken"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "checkoutToken"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "externalInvoiceId"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "externalCustomerId"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "externalTransactionId"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "externalProvider"`
        );
    }
}
