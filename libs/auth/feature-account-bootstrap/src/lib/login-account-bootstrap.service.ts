import {
  AuthCommands,
  ProfileCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateProfileDto,
  LoginRequest,
  ProfileDto,
} from '@optimistic-tanuki/models';
import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import {
  catchError,
  firstValueFrom,
  TimeoutError,
  timeout,
  throwError,
} from 'rxjs';

type RpcClient = Pick<ClientProxy, 'send'> &
  Partial<Pick<ClientProxy, 'connect' | 'close'>>;

const AUTH_USER_ID_TIMEOUT_MS = 5000;
const PROFILE_GET_ALL_TIMEOUT_MS = 5000;
const RPC_CONNECTION_TIMEOUT_MS = 5000;

@Injectable()
export class LoginAccountBootstrapService {
  constructor(
    private readonly authClient: RpcClient,
    private readonly profileClient: RpcClient,
    private readonly permissionsClient: Pick<ClientProxy, 'send'>,
    private readonly roleInit: Pick<RoleInitService, 'processNow'>
  ) {}

  private readonly clientConnections = new Map<object, Promise<void>>();

  private async connectOnce(
    client: RpcClient,
    operation: string
  ): Promise<void> {
    if (typeof client.connect !== 'function') {
      return;
    }

    const timeoutMarker = Symbol('connection-timeout');
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let connection: Promise<unknown>;

    try {
      connection = Promise.resolve(client.connect());
      connection.catch(() => undefined);
      await Promise.race([
        connection,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(timeoutMarker),
            RPC_CONNECTION_TIMEOUT_MS
          );
        }),
      ]);
    } catch (error) {
      if (error === timeoutMarker) {
        throw new Error(`${operation} connection timed out`);
      }
      throw new Error(`${operation} connection failed`);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private resetClient(client: RpcClient): void {
    try {
      client.close?.();
    } catch {
      // A failed reset must not replace the operation-specific safe error.
    }
  }

  private async connectWithRetry(
    client: RpcClient,
    operation: string
  ): Promise<void> {
    try {
      await this.connectOnce(client, operation);
      return;
    } catch {
      this.resetClient(client);
    }

    try {
      await this.connectOnce(client, operation);
    } catch (error) {
      this.resetClient(client);
      throw error;
    }
  }

  private async ensureConnection(
    client: RpcClient,
    operation: string
  ): Promise<void> {
    let connection = this.clientConnections.get(client);
    if (!connection) {
      connection = this.connectWithRetry(client, operation);
      this.clientConnections.set(client, connection);
      connection.catch(() => {
        if (this.clientConnections.get(client) === connection) {
          this.clientConnections.delete(client);
        }
      });
    }
    await connection;
  }

  private async sendWithConnectionAndTimeout<T>(
    client: RpcClient,
    pattern: object,
    payload: unknown,
    operation: string,
    timeoutMs: number
  ): Promise<T> {
    await this.ensureConnection(client, operation);

    return firstValueFrom(
      client.send(pattern, payload).pipe(
        timeout(timeoutMs),
        catchError((error: unknown) =>
          error instanceof TimeoutError
            ? throwError(() => new Error(`${operation} request timed out`))
            : throwError(() => error)
        )
      )
    ) as Promise<T>;
  }

  private async getProfiles(userId: string): Promise<ProfileDto[]> {
    return this.sendWithConnectionAndTimeout<ProfileDto[]>(
      this.profileClient,
      { cmd: ProfileCommands.GetAll },
      { where: { userId } },
      'Profile GetAll',
      PROFILE_GET_ALL_TIMEOUT_MS
    );
  }

  async login(data: LoginRequest, appScope: string) {
    const normalizedRequest: LoginRequest = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    const userIdResult: string | { userId?: string; id?: string } =
      await this.sendWithConnectionAndTimeout(
        this.authClient,
        { cmd: AuthCommands.UserIdFromEmail },
        { email: normalizedRequest.email },
        'Auth UserIdFromEmail',
        AUTH_USER_ID_TIMEOUT_MS
      );
    const userId =
      typeof userIdResult === 'string'
        ? userIdResult
        : userIdResult?.userId || userIdResult?.id;

    if (!userId) {
      throw new Error(
        `Unable to resolve userId for email=${normalizedRequest.email}`
      );
    }

    const profiles = await this.getProfiles(userId);

    const effectiveAppScope =
      appScope === 'owner-console' ? 'global' : appScope;
    let appScopedProfile = profiles.find(
      (profile) => profile.appScope === effectiveAppScope
    );
    const globalProfile = profiles.find(
      (profile) => !profile.appScope || profile.appScope === 'global'
    );
    const seedProfile = globalProfile || profiles[0] || null;

    if (!appScopedProfile && effectiveAppScope !== 'global') {
      if (!seedProfile) {
        throw new Error('No profile available for user');
      }

      const newProfile: CreateProfileDto & {
        appScope: string;
        copyPermissionsFromGlobalProfile?: boolean;
      } = {
        userId: seedProfile.userId,
        name: seedProfile.profileName || normalizedRequest.email,
        description: '',
        profilePic: seedProfile.avatarUrl || '',
        coverPic: '',
        bio: seedProfile.bio || '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        appScope: effectiveAppScope,
        copyPermissionsFromGlobalProfile: false,
      };

      const createdProfile = (await firstValueFrom(
        this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
      )) as ProfileDto;

      const roleInitOptions = new RoleInitBuilder()
        .setScopeName(effectiveAppScope)
        .setProfile(createdProfile.id)
        .addDefaultProfileOwner(createdProfile.id, effectiveAppScope)
        .addAppScopeDefaults()
        .addAssetOwnerPermissions()
        .build();

      await this.roleInit.processNow(roleInitOptions);
      appScopedProfile = createdProfile;
    }

    const profileToUse =
      effectiveAppScope === 'global'
        ? globalProfile || profiles[0] || null
        : appScopedProfile;

    if (!profileToUse) {
      throw new Error('No profile available for user');
    }

    if (appScope === 'owner-console') {
      const [ownerConsoleRoles, globalRoles] = await Promise.all([
        firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.GetUserRoles },
            { profileId: profileToUse.id, appScope: 'owner-console' }
          )
        ),
        firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.GetUserRoles },
            { profileId: profileToUse.id, appScope: 'global' }
          )
        ),
      ]);
      const roles = [
        ...((ownerConsoleRoles ?? []) as Array<{ role?: { name?: string } }>),
        ...((globalRoles ?? []) as Array<{ role?: { name?: string } }>),
      ];

      const allowedRoleNames = new Set([
        'owner_console_owner',
        'owner',
        'global_admin',
        'system_admin',
      ]);
      const hasOwnerConsoleAccess = roles.some((assignment) =>
        allowedRoleNames.has(assignment.role?.name || '')
      );

      if (!hasOwnerConsoleAccess) {
        throw new Error(
          'This account is not authorized for Owner Console access.'
        );
      }

      const hasOwnerConsoleRole = (
        (ownerConsoleRoles ?? []) as Array<{ role?: { name?: string } }>
      ).some((assignment) => assignment.role?.name === 'owner_console_owner');
      if (!hasOwnerConsoleRole) {
        await this.roleInit.processNow(
          new RoleInitBuilder()
            .setScopeName('owner-console')
            .setProfile(profileToUse.id)
            .assignOwnerRole()
            .build()
        );
      }
    }

    return firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.Login },
        { ...normalizedRequest, profileId: profileToUse.id }
      )
    );
  }
}
