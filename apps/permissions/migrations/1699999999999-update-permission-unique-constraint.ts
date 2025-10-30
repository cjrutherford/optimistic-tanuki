import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePermissionUniqueConstraint1699999999999
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_permission_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permission_name_appScope_targetId" ON "permission" ("name", "appScope", "targetId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_permission_name_appScope_targetId"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permission_name" ON "permission" ("name")`
    );
  }
}
