import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadPresenceGaps1788722198433 implements MigrationInterface {
  name = 'AddLeadPresenceGaps1788722198433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" ADD "presenceGaps" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "presenceGapScore" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "presenceGapScore"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "presenceGaps"`);
  }
}
