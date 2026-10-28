import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AccountDeletionOwner,
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionGrant,
  ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND,
  ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND,
  ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND,
  ACCOUNT_DELETION_ENVIRONMENT_COMMAND,
} from '@optimistic-tanuki/models';
import {
  AuthCommands,
  AppConfigCommands,
  AssetCommands,
  ClassifiedCommands,
  ForumCommands,
  PermissionCommands,
  SocialCommands,
  VideoCommands,
  WorkspaceCommands,
  PaymentCommands,
  ChatCommands,
} from '@optimistic-tanuki/constants';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { DeletionOwnerPorts } from './account-deletion-runner.service';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';
const commands = (v: {
  FENCE_ACCOUNT_DELETION: string;
  ERASE_ACCOUNT_DELETION: string;
  READBACK_ACCOUNT_DELETION: string;
}) => ({
  fence: v.FENCE_ACCOUNT_DELETION,
  erase: v.ERASE_ACCOUNT_DELETION,
  readback: v.READBACK_ACCOUNT_DELETION,
});
const routes = {
  profile: {
    fence: ProfileCommands.FenceAccountDeletion,
    erase: ProfileCommands.EraseAccountDeletion,
    readback: ProfileCommands.ReadbackAccountDeletion,
    finalize: ProfileCommands.FinalizeAccountDeletion,
  },
  assets: commands(AssetCommands),
  videos: commands(VideoCommands),
  permissions: commands(PermissionCommands),
  social: commands(SocialCommands),
  forum: commands(ForumCommands),
  workspace: commands(WorkspaceCommands),
  'app-configurator': commands(AppConfigCommands),
  classifieds: commands(ClassifiedCommands),
  payments: commands(PaymentCommands),
  'chat-collector': commands(ChatCommands),
};
type Endpoint = { host: string; port: number };
const endpointValid = (v: unknown): v is Endpoint =>
  Boolean(
    v &&
      typeof v === 'object' &&
      typeof (v as Endpoint).host === 'string' &&
      /^[a-zA-Z0-9.:-]{1,255}$/.test((v as Endpoint).host) &&
      Number.isInteger((v as Endpoint).port) &&
      (v as Endpoint).port > 0 &&
      (v as Endpoint).port <= 65535
  );

@Injectable()
export class AccountDeletionRpcOwnersService implements OnModuleDestroy {
  readonly ports: DeletionOwnerPorts;
  private readonly clients = new Map<string, ClientProxy>();
  private readonly replicas = new Map<AccountDeletionOwner, Endpoint[]>();
  constructor(
    config: ConfigService,
    private readonly auth: AccountDeletionOwnerService
  ) {
    let inventory = config.get<unknown>('deletion.owner_replicas');
    if (
      inventory === undefined &&
      process.env['ACCOUNT_DELETION_OWNER_REPLICAS'] !== undefined
    ) {
      const raw = process.env['ACCOUNT_DELETION_OWNER_REPLICAS']!;
      if (raw.length > 64000) throw Error('DELETION_REPLICA_INVENTORY_INVALID');
      try {
        inventory = JSON.parse(raw);
      } catch {
        throw Error('DELETION_REPLICA_INVENTORY_INVALID');
      }
    }
    if (
      inventory !== undefined &&
      (!inventory || typeof inventory !== 'object' || Array.isArray(inventory))
    )
      throw Error('DELETION_REPLICA_INVENTORY_INVALID');
    const declared = new Map<string, Endpoint[]>();
    for (const [owner, values] of Object.entries(inventory ?? {})) {
      if (
        !(ACCOUNT_DELETION_OWNERS as readonly string[]).includes(owner) ||
        !Array.isArray(values) ||
        !values.length ||
        values.length > 8 ||
        values.some((v) => !endpointValid(v)) ||
        new Set(values.map((v) => `${v.host.toLowerCase()}:${v.port}`)).size !==
          values.length
      )
        throw Error('DELETION_REPLICA_INVENTORY_INVALID');
      declared.set(
        owner,
        values.map((v) => ({ host: v.host, port: v.port }))
      );
    }
    const ports = new Map<
      AccountDeletionOwner,
      (grant: AccountDeletionGrant) => Promise<unknown>
    >();
    this.replicas.set('authentication', declared.get('authentication') ?? []);
    ports.set('authentication', async (grant) => {
      if (grant.action === 'fence') await this.assertSharedArtifactStore(grant);
      const first =
        grant.action === 'fence'
          ? await auth.fence(grant)
          : grant.action === 'erase'
          ? await auth.erase(grant)
          : grant.action === 'readback'
          ? await auth.readback(grant)
          : undefined;
      if (!first) throw Error('DELETION_AUTH_ACTION_INVALID');
      const replicas = declared.get('authentication') ?? [];
      if (replicas.length) {
        const command = {
          fence: AuthCommands.FenceAuthenticationDeletion,
          erase: AuthCommands.EraseAuthenticationDeletion,
          readback: AuthCommands.ReadbackAuthenticationDeletion,
        }[grant.action as 'fence' | 'erase' | 'readback'];
        const reply = await this.everyReplica(
          'authentication',
          replicas,
          command,
          grant,
          false
        );
        if (!isDeepStrictEqual(first, reply))
          throw Error('DELETION_REPLICA_REPLY_CONFLICT');
      }
      return first;
    });
    for (const [owner, actions] of Object.entries(routes)) {
      const singleton = config.get<Endpoint>(
        'services.' + owner.replace(/-/g, '_')
      );
      const endpoints =
        declared.get(owner) ?? (endpointValid(singleton) ? [singleton] : []);
      this.replicas.set(owner as AccountDeletionOwner, endpoints);
      ports.set(owner as AccountDeletionOwner, async (grant) => {
        if (!endpoints.length) throw Error('DELETION_OWNER_ENDPOINT_REQUIRED');
        if (
          owner === 'assets' &&
          grant.action === 'fence' &&
          endpoints.length > 1
        )
          await this.assertSharedAssetsStore(endpoints, grant);
        const command = (actions as Record<string, string>)[grant.action];
        if (!command) throw Error('DELETION_OWNER_ACTION_INVALID');
        return this.everyReplica(owner, endpoints, command, grant, true);
      });
    }
    this.ports = ports;
  }
  private async assertSharedArtifactStore(
    grant: AccountDeletionGrant
  ): Promise<void> {
    const endpoints = this.replicas.get('authentication') ?? [];
    const nonce = randomUUID();
    try {
      const written = await this.auth.runtimeCustody(grant, {
        nonce,
        mode: 'write',
      });
      const replies = await Promise.all(
        endpoints.map((endpoint) =>
          firstValueFrom(
            this.clientFor('authentication', endpoint)
              .send(
                { cmd: ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND },
                { grant, probe: { nonce, mode: 'read' } }
              )
              .pipe(timeout(10000))
          )
        )
      );
      this.assertStoreReplies('authentication', [written, ...replies]);
    } finally {
      await this.auth.runtimeCustody(grant, { nonce, mode: 'remove' });
    }
  }
  private assertStoreReplies(
    owner: string,
    replies: Array<{ owner?: unknown; storeId?: unknown }>
  ): void {
    if (
      !replies.length ||
      replies.some(
        (reply) =>
          reply?.owner !== owner ||
          typeof reply.storeId !== 'string' ||
          !/^(local:[0-9a-f-]{36}|s3:[0-9a-f]{64})$/.test(reply.storeId)
      ) ||
      new Set(replies.map((reply) => reply.storeId)).size !== 1
    )
      throw Error('DELETION_SHARED_STORE_UNVERIFIED');
  }
  private async assertSharedAssetsStore(
    endpoints: Endpoint[],
    grant: AccountDeletionGrant
  ): Promise<void> {
    const nonce = randomUUID();
    const call = async (
      endpoint: Endpoint,
      mode: 'write' | 'read' | 'remove'
    ) =>
      firstValueFrom(
        this.clientFor('assets', endpoint)
          .send(
            { cmd: ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND },
            { grant, probe: { nonce, mode } }
          )
          .pipe(timeout(10000))
      );
    try {
      const written = await call(endpoints[0], 'write');
      const replies = await Promise.all(
        endpoints.slice(1).map((endpoint) => call(endpoint, 'read'))
      );
      this.assertStoreReplies('assets', [written, ...replies]);
    } finally {
      await call(endpoints[0], 'remove');
    }
  }

  async runtimeReadbacks(grant: AccountDeletionGrant): Promise<
    Array<{
      owner: string;
      instanceId: string;
      remaining: number;
      logging: { policyVersion: number; active: boolean };
      audit?: { remaining: number };
      databaseLogging: { policyVersion: number; active: boolean };
    }>
  > {
    if (grant.action !== 'readback')
      throw Error('DELETION_RUNTIME_ACTION_INVALID');
    const endpoints = this.replicas.get(grant.owner) ?? [];
    if (grant.owner === 'authentication')
      await this.assertSharedArtifactStore(grant);
    if (grant.owner === 'assets' && endpoints.length > 1)
      await this.assertSharedAssetsStore(endpoints, grant);
    if (grant.owner !== 'authentication' && !endpoints.length)
      throw Error('DELETION_OWNER_ENDPOINT_REQUIRED');
    const remote = await Promise.all(
      endpoints.map(async (endpoint) => {
        if (grant.owner !== 'authentication') {
          const purged = await firstValueFrom(
            this.clientFor(grant.owner, endpoint)
              .send({ cmd: ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND }, grant)
              .pipe(timeout(60000))
          );
          if (purged?.purged !== true || purged.remaining !== 0)
            throw Error('DELETION_SNAPSHOT_READBACK');
        }
        return firstValueFrom(
          this.clientFor(grant.owner, endpoint)
            .send({ cmd: ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND }, grant)
            .pipe(timeout(60000))
        );
      })
    );
    const local =
      grant.owner === 'authentication'
        ? [await this.auth.runtimeReadback(grant)]
        : [];
    const replies = [...local, ...remote];
    for (const reply of replies) {
      if (
        !reply ||
        reply.owner !== grant.owner ||
        reply.remaining !== 0 ||
        typeof reply.instanceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          reply.instanceId
        ) ||
        reply.logging?.policyVersion !== 1 ||
        typeof reply.logging.active !== 'boolean' ||
        reply.databaseLogging?.policyVersion !== 1 ||
        typeof reply.databaseLogging.active !== 'boolean'
      )
        throw Error('DELETION_RUNTIME_REPLY_INVALID');
    }
    if (new Set(remote.map((reply) => reply.instanceId)).size !== remote.length)
      throw Error('DELETION_REPLICA_ALIAS_UNVERIFIED');
    return [
      ...new Map(replies.map((reply) => [reply.instanceId, reply])).values(),
    ];
  }
  private clientFor(owner: string, endpoint: Endpoint): ClientProxy {
    const key = `${owner}:${endpoint.host.toLowerCase()}:${endpoint.port}`;
    let client = this.clients.get(key);
    if (!client) {
      client = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: endpoint,
      });
      this.clients.set(key, client);
    }
    return client;
  }

  private async everyReplica(
    owner: string,
    endpoints: Endpoint[],
    command: string,
    grant: AccountDeletionGrant,
    snapshots: boolean
  ): Promise<unknown> {
    const results = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const client = this.clientFor(owner, endpoint);
        const environment = await firstValueFrom(
          client
            .send({ cmd: ACCOUNT_DELETION_ENVIRONMENT_COMMAND }, grant)
            .pipe(timeout(10000))
        );
        if (
          environment?.owner !== owner ||
          environment.logging?.policyVersion !== 1 ||
          environment.logging.active !== true ||
          environment.databaseLogging?.policyVersion !== 1 ||
          environment.databaseLogging.active !== true
        )
          throw Error('DELETION_ENVIRONMENT_UNVERIFIED');
        const result = await firstValueFrom(
          client.send({ cmd: command }, grant).pipe(timeout(20000))
        );
        if (snapshots && grant.action === 'fence') {
          const purged = await firstValueFrom(
            client
              .send({ cmd: ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND }, grant)
              .pipe(timeout(60000))
          );
          if (purged?.purged !== true || purged.remaining !== 0)
            throw Error('DELETION_SNAPSHOT_READBACK');
        }
        return result;
      })
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const replies = results.map(
      (r) => (r as PromiseFulfilledResult<unknown>).value
    );
    if (
      !replies.length ||
      replies.some((reply) => !isDeepStrictEqual(reply, replies[0]))
    )
      throw Error('DELETION_REPLICA_REPLY_CONFLICT');
    return replies[0];
  }
  onModuleDestroy() {
    for (const client of this.clients.values()) client.close();
    this.clients.clear();
  }
}
