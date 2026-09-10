import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentReportScope1787514759914 implements MigrationInterface {
  name = 'AddContentReportScope1787514759914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_report" ADD "appScope" character varying NOT NULL DEFAULT 'social'`
    );
    await queryRunner.query(
      `ALTER TABLE "content_report" ADD "workspaceId" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_report" DROP COLUMN "workspaceId"`
    );
    await queryRunner.query(
      `ALTER TABLE "content_report" DROP COLUMN "appScope"`
    );
  }
}
