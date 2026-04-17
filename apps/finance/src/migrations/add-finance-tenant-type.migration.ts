import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinanceTenantType1760613363000 implements MigrationInterface {
  name = 'AddFinanceTenantType1760613363000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "finance_tenant" ADD COLUMN IF NOT EXISTS "type" character varying'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "finance_tenant" DROP COLUMN IF EXISTS "type"'
    );
  }
}
