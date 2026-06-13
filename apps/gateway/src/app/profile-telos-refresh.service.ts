import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProfileCommands,
  ProfileTelosCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { UpsertProfileTelosSourceDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProfileTelosRefreshService {
  private readonly l = new Logger(ProfileTelosRefreshService.name);
  private readonly queuedTasks = new Map<string, () => Promise<void>>();
  private readonly activeTasks = new Set<string>();
  private readonly rerunTasks = new Map<string, () => Promise<void>>();

  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy
  ) {}

  queueSourceRefresh(args: {
    profileId: string;
    namespaceKey: string;
    sourceClient: ClientProxy;
    sourceCommand: string;
    logContext: string;
  }): void {
    this.queueTask(
      `${args.namespaceKey}:${args.profileId}`,
      async () => {
        const profile = await firstValueFrom(
          this.profileClient.send(
            { cmd: ProfileCommands.Get },
            { id: args.profileId }
          )
        );
        if (!profile) {
          return;
        }

        const facts = await firstValueFrom(
          args.sourceClient.send(
            { cmd: args.sourceCommand },
            { profileId: args.profileId }
          )
        );

        await firstValueFrom(
          this.telosDocsClient.send(
            { cmd: ProfileTelosCommands.UPSERT_SOURCE },
            this.buildTelosUpsertPayload(profile, facts)
          )
        );
      },
      args.logContext
    );
  }

  queueDirectUpsert(args: {
    profile: Record<string, any>;
    namespaceKey: string;
    facts: UpsertProfileTelosSourceDto['facts'];
    logContext: string;
  }): void {
    this.queueTask(
      `${args.namespaceKey}:${args.profile.id}`,
      async () => {
        await firstValueFrom(
          this.telosDocsClient.send(
            { cmd: ProfileTelosCommands.UPSERT_SOURCE },
            this.buildTelosUpsertPayload(args.profile, args.facts)
          )
        );
      },
      args.logContext
    );
  }

  private queueTask(
    key: string,
    task: () => Promise<void>,
    logContext: string
  ): void {
    if (this.activeTasks.has(key)) {
      this.rerunTasks.set(key, task);
      return;
    }

    if (this.queuedTasks.has(key)) {
      this.queuedTasks.set(key, task);
      return;
    }

    this.queuedTasks.set(key, task);
    setTimeout(() => {
      void this.runTask(key, logContext);
    }, 0);
  }

  private async runTask(key: string, logContext: string): Promise<void> {
    const task = this.queuedTasks.get(key);
    if (!task) {
      return;
    }

    this.queuedTasks.delete(key);
    this.activeTasks.add(key);

    try {
      await task();
    } catch (error) {
      this.l.warn(
        `Failed to refresh TELOS for ${logContext}: ${
          error instanceof Error ? error.message : error
        }`
      );
    } finally {
      this.activeTasks.delete(key);
      const rerunTask = this.rerunTasks.get(key);
      if (rerunTask) {
        this.rerunTasks.delete(key);
        this.queuedTasks.set(key, rerunTask);
        setTimeout(() => {
          void this.runTask(key, logContext);
        }, 0);
      }
    }
  }

  private normalizeDelimitedValues(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private buildTelosUpsertPayload(
    profile: Record<string, any>,
    facts: UpsertProfileTelosSourceDto['facts']
  ): UpsertProfileTelosSourceDto {
    return {
      profileId: profile.id,
      appScope: profile.appScope || 'global',
      profileName: profile.profileName,
      bio: profile.bio || '',
      occupation: profile.occupation || '',
      location: profile.location || '',
      interests: this.normalizeDelimitedValues(profile.interests),
      skills: this.normalizeDelimitedValues(profile.skills),
      facts,
    };
  }
}
