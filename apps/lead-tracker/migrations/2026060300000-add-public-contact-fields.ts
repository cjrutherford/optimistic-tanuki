import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicContactFields2026060300000 implements MigrationInterface {
  name = 'AddPublicContactFields2026060300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "contactSubject" character varying`
    );
    await queryRunner.query(`ALTER TABLE "leads" ADD "contactMessage" text`);
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "contactSourceLabel" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "lastRespondedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "lastRespondedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "contactSourceLabel"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "contactMessage"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "contactSubject"`);
  }
}
