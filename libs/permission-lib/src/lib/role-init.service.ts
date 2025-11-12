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
      throw new RpcException(`AppScope ${item.scopeName} not found`);
      // try {
      //   appScope = await firstValueFrom(
      //     this.permissionsClient.send(
      //       { cmd: AppScopeCommands.Create },
      //       {
      //         name: item.scopeName,
      //         resourceId: item.scopeResourceId,
      //         description: `Auto-created scope ${item.scopeName}:${item.scopeResourceId}`,
      //       }
      //     )
      //   ).catch(() => null);
      // } catch (e) {
      //   this.logger.debug(
      //     'AppScope.Create failed',
      //     (e as { message: string })?.message || e
      //   );
      // }
    }
    const appScopeId = appScope?.id ?? item.scopeResourceId ?? item.scopeName;

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

    // 3) create roles and attach permissions
    const createdRoles: Record<string, any> = {};
    for (const r of item.roles || []) {
      try {
        const role = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.Create },
            {
              name: r.name,
              description: r.description || '',
              scope: appScopeId,
            }
          )
        );
        createdRoles[r.name] = role;
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
      } catch (e) {
        this.logger.debug(
          `Role.Create failed ${r.name}`,
          (e as { message: string })?.message || e
        );
      }
    }

    // 4) assign roles to profiles/users -> create RoleAssignment in permissions service
    for (const a of item.assignments || []) {
      const role = createdRoles[a.roleName];
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
      }
    }

    this.logger.log(
      `completed role-init scope=${item.scopeName} resource=${item.scopeResourceId}`
    );
  }
}
