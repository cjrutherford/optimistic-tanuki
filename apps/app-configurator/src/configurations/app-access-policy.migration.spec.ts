import { AddAppAccessPolicy1788886797394 } from '../../migrations/1788886797394-add-app-access-policy';

describe('AddAppAccessPolicy1788886797394', () => {
  it('creates the referenced unique index before adding composite foreign keys', async () => {
    const executed: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executed.push(sql);
        return [];
      }),
    };

    await new AddAppAccessPolicy1788886797394().up(queryRunner as never);

    const indexPosition = executed.findIndex((sql) =>
      sql.includes(
        'CREATE UNIQUE INDEX "IDX_7eab2231eb529d834b9518b103" ON "app_instances" ("id", "workspaceId", "appScope")'
      )
    );
    const configurationForeignKeyPosition = executed.findIndex((sql) =>
      sql.includes(
        'ADD CONSTRAINT "FK_6dd7b952a83b50efdbf26a7019f" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope")'
      )
    );
    const membershipForeignKeyPosition = executed.findIndex((sql) =>
      sql.includes(
        'ADD CONSTRAINT "FK_8d1426b7387545e56d3cc4b06e6" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope")'
      )
    );

    expect(indexPosition).toBeGreaterThanOrEqual(0);
    expect(configurationForeignKeyPosition).toBeGreaterThan(indexPosition);
    expect(membershipForeignKeyPosition).toBeGreaterThan(indexPosition);
  });

  it('refuses to downgrade while denied memberships would be unmappable', async () => {
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('WHERE "status" = \'denied\'')) {
          return [{ count: '1' }];
        }
        return [];
      }),
    };

    await expect(
      new AddAppAccessPolicy1788886797394().down(queryRunner as never)
    ).rejects.toThrow(
      'Cannot revert app access policy migration while denied memberships exist'
    );

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('recreates the legacy unique index in the referenced column order on downgrade', async () => {
    const executed: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executed.push(sql);
        return [];
      }),
    };

    await new AddAppAccessPolicy1788886797394().down(queryRunner as never);

    const indexPosition = executed.findIndex((sql) =>
      sql.includes(
        'CREATE UNIQUE INDEX "IDX_app_instances_id_workspace_scope" ON "app_instances" ("id", "workspaceId", "appScope")'
      )
    );
    const configurationForeignKeyPosition = executed.findIndex((sql) =>
      sql.includes(
        'ADD CONSTRAINT "FK_app_configuration_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope")'
      )
    );
    const membershipForeignKeyPosition = executed.findIndex((sql) =>
      sql.includes(
        'ADD CONSTRAINT "FK_app_memberships_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope")'
      )
    );

    expect(indexPosition).toBeGreaterThanOrEqual(0);
    expect(configurationForeignKeyPosition).toBeGreaterThan(indexPosition);
    expect(membershipForeignKeyPosition).toBeGreaterThan(indexPosition);
  });
});
