// ...existing code...
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RoleInitOptions } from './permission-builder';
import { AppScopePolicyRegistry } from '@optimistic-tanuki/permissions-domain';
import {
  PermissionCommands,
  RoleCommands,
  AppScopeCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';

@Injectable()
export class RoleInitService {
  private readonly queue: RoleInitOptions[] = [];
  private processing = false;
  private readonly logger = new Logger(RoleInitService.name);
  private readonly policyRegistry = new AppScopePolicyRegistry();

  constructor(
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
  ) {}

  enqueue(options: RoleInitOptions) {
    this.queue.push(options);
    this.startWorker();
  }

  /**
   * Process role initialization synchronously and wait for completion.
   * Use this when you need permissions to be ready before returning to the caller.
   */
  async processNow(options: RoleInitOptions): Promise<void> {
    await this.processOne(options);
  }

  private startWorker() {
    if (this.processing) return;
    this.processing = true;
    setImmediate(() =>
      this.processLoop().catch((err) => {
        this.logger.error('RoleInit worker failed', err);
        this.processing = false;
      }),
    );
  }

  private async processLoop() {
    while (this.queue.length) {
      const item = this.queue.shift();
      if (!item) continue;
      try {
        await this.processOne(item);
      } catch (e) {
        this.logger.error('processOne failed', e);
      }
    }
    this.processing = false;
  }

  private async processOne(item: RoleInitOptions) {
    this.logger.log(
      `role-init scope=${item.scopeName} resource=${item.scopeResourceId}`,
    );

    // 1) ensure app scope
    let appScope: any = null;
    try {
      appScope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.GetByName },
          {
            name: item.scopeName,
          },
        ),
      ).catch(() => null);
      this.logger.log(appScope);
    } catch (e: unknown) {
      this.logger.debug(
        'AppScope.GetByName failed',
        (e as { message: string })?.message || e,
      );
    }
    if (!appScope) {
      try {
        appScope = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: AppScopeCommands.Create },
            {
              name: item.scopeName,
              resourceId: item.scopeResourceId,
              description: `Auto-created scope ${item.scopeName}:${item.scopeResourceId}`,
            },
          ),
        ).catch(() => null);
      } catch (e) {
        this.logger.debug(
          'AppScope.Create failed',
          (e as { message: string })?.message || e,
        );
      }
    }
    if (!appScope) {
      throw new RpcException(`AppScope ${item.scopeName} not found`);
    }
    const appScopeId = appScope?.id ?? item.scopeResourceId ?? item.scopeName;

    const scopeCache = new Map<string, any>();

    // 2) create permissions (match CreatePermissionDto)
    const permNameToId: Record<string, string> = {};
    for (const p of item.permissions || []) {
      const payload = {
        name: p.name,
        description: p.description || '',
        resource: p.resource,
        action: p.action,
        targetId: p.targetId ?? appScopeId,
      };
      try {
        const created = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: PermissionCommands.Create },
            payload,
          ),
        );
        if (created?.id) permNameToId[p.name] = created.id;
      } catch (e) {
        this.logger.debug(
          `Permission.Create failed for ${p.name}`,
          (e as { message: string })?.message || e,
        );
        // fallback: try lookup (optional)
      }
    }

    const permissionMirrors = this.policyRegistry
      .get(item.scopeName || 'default')
      .buildPermissionMirrors?.(item.permissions || []);

    for (const mirror of permissionMirrors || []) {
      const mirroredPermissions = (item.permissions || []).filter(
        (permission) => mirror.permissionNames.includes(permission.name),
      );

      if (!mirroredPermissions.length) {
        continue;
      }

      try {
        let targetScope = scopeCache.get(mirror.targetScope);
        if (!targetScope) {
          targetScope = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: AppScopeCommands.GetByName },
              { name: mirror.targetScope },
            ),
          ).catch(() => null);

          if (targetScope) {
            scopeCache.set(mirror.targetScope, targetScope);
          }
        }

        if (!targetScope?.id) {
          this.logger.debug(
            `Permission mirror skipped; scope ${mirror.targetScope} not found`,
          );
          continue;
        }

        for (const permission of mirroredPermissions) {
          const mirroredPayload = {
            name: permission.name,
            description: permission.description || '',
            resource: permission.resource,
            action: permission.action,
            targetId: targetScope.id,
          };

          try {
            await firstValueFrom(
              this.permissionsClient.send(
                { cmd: PermissionCommands.Create },
                mirroredPayload,
              ),
            );
            this.logger.debug(
              `Created mirrored permission ${permission.name} in ${mirror.targetScope}`,
            );
          } catch (e) {
            this.logger.debug(
              `Permission mirror failed for ${permission.name} in ${mirror.targetScope}`,
              (e as { message: string })?.message || e,
            );
          }
        }
      } catch (e) {
        this.logger.debug(
          `Permission mirror lookup failed for ${mirror.targetScope}`,
          (e as { message: string })?.message || e,
        );
      }
    }

    // 3) create roles and attach permissions
    const createdRoles: Record<string, any> = {};
    for (const r of item.roles || []) {
      let role: any | null = null;
      // Try creating role first (for newly defined roles containing permission set)
      try {
        role = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.Create },
            {
              name: r.name,
              description: r.description || '',
              appScopeId: appScopeId,
            },
          ),
        );
        createdRoles[r.name] = role;
      } catch (e) {
        // Creation failed -> try to find existing role by name & scope, then fall back to global scope
        this.logger.debug(
          `Role.Create failed ${r.name}`,
          (e as { message: string })?.message || e,
        );
        try {
          // First try to find role in the specific app scope
          let existing = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.GetByName },
              { name: r.name, appScope: item.scopeName },
            ),
          ).catch(() => null);

          // If not found in app scope, try global scope
          if (!existing && item.scopeName !== 'global') {
            this.logger.debug(
              `Role ${r.name} not found in ${item.scopeName}, trying global scope`,
            );
            existing = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: r.name, appScope: 'global' },
              ),
            ).catch(() => null);
          }

          // Third try: find role without scope at all (legacy or global fallback)
          if (!existing) {
            this.logger.debug(
              `Role ${r.name} not found in global scope, trying without scope`,
            );
            existing = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: r.name },
              ),
            ).catch(() => null);
          }

          if (existing) {
            this.logger.debug(`Found existing role ${r.name} -> using it`);
            createdRoles[r.name] = existing;
            role = existing;
          } else {
            this.logger.debug(`No existing role found for ${r.name}, skipping`);
          }
        } catch (err) {
          this.logger.debug(
            `Role lookup failed for ${r.name}`,
            (err as { message: string })?.message || err,
          );
        }
      }

      if (!role) {
        continue; // nothing to attach permissions to
      }

      for (const pname of r.permissions || []) {
        const pid = permNameToId[pname];
        const attachPayload: any = { roleId: role.id };
        if (pid) attachPayload.permissionId = pid;
        else attachPayload.permissionName = pname;
        try {
          await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.AddPermission },
              attachPayload,
            ),
          );
        } catch (e) {
          this.logger.debug(
            `Role.AddPermission failed role=${r.name} perm=${pname}`,
            (e as { message: string })?.message || e,
          );
        }
      }
    }

    // 4) assign roles to profiles/users -> create RoleAssignment in permissions service
    for (const a of item.assignments || []) {
      let role = createdRoles[a.roleName];
      // If we didn't create the role in this run, attempt to lookup an existing role by name/scope
      if (!role) {
        try {
          // First try app scope
          role = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.GetByName },
              { name: a.roleName, appScope: item.scopeName },
            ),
          ).catch(() => null);

          // Fall back to global scope if not found
          if (!role && item.scopeName !== 'global') {
            role = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: a.roleName, appScope: 'global' },
              ),
            ).catch(() => null);
          }

          // Fall back to no scope if still not found
          if (!role) {
            role = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: a.roleName },
              ),
            ).catch(() => null);
          }
        } catch (e) {
          this.logger.debug(
            `Role lookup before assignment failed role=${a.roleName}`,
            (e as { message: string })?.message || e,
          );
          role = null;
        }
      }

      if (!role) {
        this.logger.debug(`No role for assignment ${a.roleName}`);
        continue;
      }

      const assignPayload: any = { roleId: role.id, appScopeId };
      if (a.profileId) assignPayload.profileId = a.profileId;
      if (a.userId) assignPayload.userId = a.userId;
      try {
        await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.Assign },
            assignPayload,
          ),
        );
      } catch (e) {
        this.logger.debug(
          `Role.Assign failed role=${a.roleName}`,
          (e as { message: string })?.message || e,
        );
        continue;
      }

      const crossScopeAssignments = this.policyRegistry
        .get(item.scopeName || 'default')
        .buildCrossScopeMappings?.(a);

      for (const mappedAssignment of crossScopeAssignments || []) {
        if (!mappedAssignment.appScope) {
          continue;
        }

        try {
          let targetScope = scopeCache.get(mappedAssignment.appScope);
          if (!targetScope) {
            targetScope = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: AppScopeCommands.GetByName },
                { name: mappedAssignment.appScope },
              ),
            ).catch(() => null);

            if (targetScope) {
              scopeCache.set(mappedAssignment.appScope, targetScope);
            }
          }

          if (!targetScope?.id) {
            this.logger.debug(
              `RoleInitService: ${mappedAssignment.appScope} app scope not found; skipping ${a.roleName} mapping`,
            );
            continue;
          }

          const mappedPayload: any = {
            roleId: role.id,
            appScopeId: targetScope.id,
          };
          if (mappedAssignment.profileId) {
            mappedPayload.profileId = mappedAssignment.profileId;
          }
          if (mappedAssignment.userId) {
            mappedPayload.userId = mappedAssignment.userId;
          }

          await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.Assign },
              mappedPayload,
            ),
          );
        } catch (e) {
          this.logger.debug(
            `Role.Assign (cross-scope) failed role=${a.roleName}`,
            (e as { message: string })?.message || e,
          );
        }
      }
    }

    this.logger.log(
      `completed role-init scope=${item.scopeName} resource=${item.scopeResourceId}`,
    );
  }
}
