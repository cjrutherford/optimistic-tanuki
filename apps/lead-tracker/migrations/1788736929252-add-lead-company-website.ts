import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadCompanyWebsite1788736929252 implements MigrationInterface {
  name = 'AddLeadCompanyWebsite1788736929252';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "companyWebsite" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "companyWebsite"`);
  }
}
