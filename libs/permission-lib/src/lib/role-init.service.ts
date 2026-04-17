// ...existing code...
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RoleInitOptions } from './permission-builder';
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

  constructor(
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy
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
      })
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
      `role-init scope=${item.scopeName} resource=${item.scopeResourceId}`
    );

    // 1) ensure app scope
    let appScope: any = null;
    try {
      appScope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.GetByName },
          {
            name: item.scopeName,
          }
        )
      ).catch(() => null);
      this.logger.log(appScope);
    } catch (e: unknown) {
      this.logger.debug(
        'AppScope.GetByName failed',
        (e as { message: string })?.message || e
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
            }
          )
        ).catch(() => null);
      } catch (e) {
        this.logger.debug(
          'AppScope.Create failed',
          (e as { message: string })?.message || e
        );
      }
    }
    if (!appScope) {
      throw new RpcException(`AppScope ${item.scopeName} not found`);
    }
    const appScopeId = appScope?.id ?? item.scopeResourceId ?? item.scopeName;

    // Cache for cross-scope mappings we may need (e.g. mapping
    // client-interface roles into the social app scope by default).
    let socialScope: any | null = null;

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
            payload
          )
        );
        if (created?.id) permNameToId[p.name] = created.id;
      } catch (e) {
        this.logger.debug(
          `Permission.Create failed for ${p.name}`,
          (e as { message: string })?.message || e
        );
        // fallback: try lookup (optional)
      }
    }

    // For client-interface scope, also create community permissions in social scope
    if (item.scopeName === 'client-interface') {
      const communityPermissions = item.permissions?.filter((p) =>
        p.name.startsWith('community.')
      );
      if (communityPermissions?.length) {
        try {
          const socialScopeForPerms = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: AppScopeCommands.GetByName },
              { name: 'social' }
            )
          ).catch(() => null);

          if (socialScopeForPerms?.id) {
            for (const p of communityPermissions) {
              const socialPayload = {
                name: p.name,
                description: p.description || '',
                resource: p.resource,
                action: p.action,
                targetId: socialScopeForPerms.id,
              };
              try {
                await firstValueFrom(
                  this.permissionsClient.send(
                    { cmd: PermissionCommands.Create },
                    socialPayload
                  )
                );
                this.logger.debug(
                  `Created community permission ${p.name} in social scope`
                );
              } catch (e) {
                this.logger.debug(
                  `Permission.Create failed for ${p.name} in social scope`,
                  (e as { message: string })?.message || e
                );
              }
            }
          }
        } catch (e) {
          this.logger.debug(
            `Failed to create community permissions in social scope`,
            (e as { message: string })?.message || e
          );
        }
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
            }
          )
        );
        createdRoles[r.name] = role;
      } catch (e) {
        // Creation failed -> try to find existing role by name & scope, then fall back to global scope
        this.logger.debug(
          `Role.Create failed ${r.name}`,
          (e as { message: string })?.message || e
        );
        try {
          // First try to find role in the specific app scope
          let existing = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.GetByName },
              { name: r.name, appScope: item.scopeName }
            )
          ).catch(() => null);

          // If not found in app scope, try global scope
          if (!existing && item.scopeName !== 'global') {
            this.logger.debug(
              `Role ${r.name} not found in ${item.scopeName}, trying global scope`
            );
            existing = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: r.name, appScope: 'global' }
              )
            ).catch(() => null);
          }

          // Third try: find role without scope at all (legacy or global fallback)
          if (!existing) {
            this.logger.debug(
              `Role ${r.name} not found in global scope, trying without scope`
            );
            existing = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: r.name }
              )
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
            (err as { message: string })?.message || err
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
              attachPayload
            )
          );
        } catch (e) {
          this.logger.debug(
            `Role.AddPermission failed role=${r.name} perm=${pname}`,
            (e as { message: string })?.message || e
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
              { name: a.roleName, appScope: item.scopeName }
            )
          ).catch(() => null);

          // Fall back to global scope if not found
          if (!role && item.scopeName !== 'global') {
            role = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: a.roleName, appScope: 'global' }
              )
            ).catch(() => null);
          }

          // Fall back to no scope if still not found
          if (!role) {
            role = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.GetByName },
                { name: a.roleName }
              )
            ).catch(() => null);
          }
        } catch (e) {
          this.logger.debug(
            `Role lookup before assignment failed role=${a.roleName}`,
            (e as { message: string })?.message || e
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
            assignPayload
          )
        );
      } catch (e) {
        this.logger.debug(
          `Role.Assign failed role=${a.roleName}`,
          (e as { message: string })?.message || e
        );
        continue;
      }

      // Default cross-scope mapping: when initializing roles for the
      // client-interface scope, ensure that profiles which receive the
      // "client_interface_user" or "community_user" role also get that role assigned in
      // the "social" app scope. This makes social routes callable by
      // default for client-interface users without requiring
      // controller-specific mapping logic.
      if (
        item.scopeName === 'client-interface' &&
        a.profileId &&
        (a.roleName === 'client_interface_user' ||
          a.roleName === 'community_owner')
      ) {
        try {
          if (!socialScope) {
            socialScope = await firstValueFrom(
              this.permissionsClient.send(
                { cmd: AppScopeCommands.GetByName },
                { name: 'social' }
              )
            ).catch(() => null);
          }

          if (socialScope?.id) {
            const socialAssignPayload: any = {
              roleId: role.id,
              appScopeId: socialScope.id,
              profileId: a.profileId,
            };
            await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.Assign },
                socialAssignPayload
              )
            );
          } else {
            this.logger.debug(
              `RoleInitService: social app scope not found; skipping ${a.roleName} -> social mapping`
            );
          }
        } catch (e) {
          this.logger.debug(
            `Role.Assign (social mirror) failed role=${a.roleName}`,
            (e as { message: string })?.message || e
          );
        }
      }
    }

    this.logger.log(
      `completed role-init scope=${item.scopeName} resource=${item.scopeResourceId}`
    );
  }
}
