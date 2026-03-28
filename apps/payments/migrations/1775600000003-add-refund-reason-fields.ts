import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundReasonFields1775600000003 implements MigrationInterface {
    name = 'AddRefundReasonFields1775600000003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE donations ADD COLUMN IF NOT EXISTS "refundReason" text'
        );
        await queryRunner.query(
            'ALTER TABLE donations ADD COLUMN IF NOT EXISTS "refundedAt" timestamp'
        );
        await queryRunner.query(
            'ALTER TABLE classified_payments ADD COLUMN IF NOT EXISTS "refundReason" text'
        );
        await queryRunner.query(
            'ALTER TABLE classified_payments ADD COLUMN IF NOT EXISTS "refundedAt" timestamp'
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE classified_payments DROP COLUMN IF EXISTS "refundedAt"'
        );
        await queryRunner.query(
            'ALTER TABLE classified_payments DROP COLUMN IF EXISTS "refundReason"'
        );
        await queryRunner.query(
            'ALTER TABLE donations DROP COLUMN IF EXISTS "refundedAt"'
        );
        await queryRunner.query(
            'ALTER TABLE donations DROP COLUMN IF EXISTS "refundReason"'
        );
    }
}