/** Load the checked-in permission seed subset for the two products, without booting config readers. */
import { readFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';
export async function seedR4Permissions(db: DataSource) {
  if (
    process.env['R4_JOURNEYS'] !== '1' ||
    db.options.database !== 'd27_permissions'
  )
    throw Error('R4_PERMISSION_FIXTURE_REQUIRED');
  const data = JSON.parse(
    await readFile(
      'apps/permissions/src/assets/default-permissions.json',
      'utf8'
    )
  );
  const allowed = new Set([
    'global',
    'community',
    'social',
    'forum',
    'client-interface',
    'local-hub',
  ]);
  const repo = (table: string) =>
    db.getRepository<any>(
      db.entityMetadatas.find((m) => m.tableName === table)!.target
    );
  const scopes = new Map<string, any>(),
    permissions = new Map<string, any>(),
    roles = new Map<string, any>();
  for (const item of data.app_scopes.filter((v: any) => allowed.has(v.name))) {
    const r = repo('app_scope');
    let row = await r.findOne({ where: { name: item.name } });
    if (!row) row = await r.save(r.create(item));
    scopes.set(item.name, row);
  }
  for (const item of data.permissions.filter((v: any) =>
    allowed.has(v.appScope)
  )) {
    const r = repo('permission'),
      scope = scopes.get(item.appScope);
    let row = await r.findOne({
      where: { name: item.name, appScopeId: scope.id },
    });
    if (!row) {
      const { appScope, ...fields } = item;
      row = await r.save(
        r.create({ ...fields, appScope: scope, appScopeId: scope.id })
      );
    }
    permissions.set(item.appScope + ':' + item.name, row);
  }
  for (const item of data.roles.filter((v: any) => allowed.has(v.appScope))) {
    const r = repo('role');
    let row = await r.findOne({
      where: { name: item.name },
      relations: ['permissions'],
    });
    if (!row)
      row = await r.save(
        r.create({
          name: item.name,
          description: item.description,
          appScope: scopes.get(item.appScope),
          permissions: [],
        })
      );
    roles.set(item.name, row);
  }
  for (const item of data.role_permissions) {
    const role = roles.get(item.role),
      permission = permissions.get(
        item.permissionAppScope + ':' + item.permission
      );
    if (!role || !permission) continue;
    if (!(role.permissions ?? []).some((p: any) => p.id === permission.id)) {
      role.permissions = [...(role.permissions ?? []), permission];
      await repo('role').save(role);
    }
  }
  return {
    scopeNames: [...scopes.keys()],
    roleCount: roles.size,
    permissionCount: permissions.size,
    source: 'apps/permissions/src/assets/default-permissions.json',
  };
}
