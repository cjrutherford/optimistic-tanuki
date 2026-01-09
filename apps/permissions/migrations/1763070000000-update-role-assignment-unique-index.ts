import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRoleAssignmentUniqueIndex1763070000000
  implements MigrationInterface
{
  name = 'UpdateRoleAssignmentUniqueIndex1763070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old unique index on (roleId, profileId, appScopeId, targetId)
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_20b82c625ef651c3bd33f73e2b"'
    );

    // Create new unique index on (roleId, profileId, appScopeId)
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_role_assignment_role_profile_scope" ON "role_assignment" ("roleId", "profileId", "appScopeId")'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new index
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_role_assignment_role_profile_scope"'
    );

    // Restore old unique index on (roleId, profileId, appScopeId, targetId)
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_20b82c625ef651c3bd33f73e2b" ON "role_assignment" ("roleId", "profileId", "appScopeId", "targetId")'
    );
  }
}
