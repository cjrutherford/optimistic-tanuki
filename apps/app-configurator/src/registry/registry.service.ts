import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AppRegistration,
  NavigationLink,
  RegistryAuditRecord,
  RegistryDriftReport,
  RegistryDriftState,
  RegistryReleaseBundle,
  RegistryReleaseRevision,
  RegistryReleaseState,
  RegistrySourceSnapshot,
  RegistryYamlExport,
} from '@optimistic-tanuki/app-registry-backend';
import {
  hashSnapshot,
  normalizeApp,
  snapshotsEqual,
  toRegistryYaml,
  unifiedDiff,
} from './registry-yaml';
import {
  AuditRecord,
  REGISTRY_STORE,
  RegistryStore,
  ReleaseRecord,
  WorkingRegistry,
} from './registry.store';

export const YAML_SEED_ACTOR = 'yaml-seed';

export interface RegistryActor {
  actor: string;
}

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(@Inject(REGISTRY_STORE) private readonly store: RegistryStore) {}

  /**
   * Imports the deployed YAML as release 1 when the database has no release.
   * It never touches an existing registry: later YAML changes show up as
   * drift instead.
   */
  async seed(input: {
    source: RegistrySourceSnapshot;
  }): Promise<{ seeded: boolean; version: number | null }> {
    const releases = await this.store.listReleases();
    if (releases.length > 0) {
      return { seeded: false, version: releases[0].version };
    }
    const source = this.requireSource(input.source);
    const working = this.toWorking(source);
    const release: ReleaseRecord = {
      version: 1,
      isCurrent: true,
      snapshot: this.toSnapshot(working),
      releaseNotes: 'Imported from the deployed apps.yaml',
      changeSummary: null,
      sourceHash: hashSnapshot(source),
      restoredFromVersion: null,
      publishedAt: new Date(),
      publishedBy: YAML_SEED_ACTOR,
    };
    const wrote = await this.store.seed(working, release, {
      action: 'seed',
      actor: YAML_SEED_ACTOR,
      summary: `Seeded the registry from YAML as version 1 (${working.apps.length} apps)`,
      reason: null,
      releaseVersion: 1,
      before: null,
      after: release.snapshot,
      metadata: {
        appCount: working.apps.length,
        linkCount: working.links.length,
      },
    });
    if (wrote) {
      this.logger.log('Seeded the app registry from YAML as release 1');
    }
    return { seeded: wrote, version: 1 };
  }

  /** The working registry with its release state, or null before seeding. */
  async get(): Promise<RegistryReleaseBundle | null> {
    const working = await this.store.loadWorking();
    if (!working) {
      return null;
    }
    return this.bundle(working, await this.store.listReleases());
  }

  async saveDraft(
    input: RegistryActor & {
      registry?: {
        version: string;
        generatedAt: string;
        apps: AppRegistration[];
      };
      links?: NavigationLink[];
      reason?: string;
    }
  ): Promise<RegistryReleaseBundle> {
    const current = await this.requireWorking();
    const next: WorkingRegistry = { ...current };
    const audit: AuditRecord[] = [];
    const reason = input.reason?.trim() || null;

    if (input.registry) {
      next.version = input.registry.version;
      next.generatedAt = input.registry.generatedAt;
      next.apps = input.registry.apps.map((app) => ({ ...app }));
      audit.push({
        action: 'apps.updated',
        actor: input.actor,
        summary: `Updated application registry to version ${next.version}`,
        reason,
        releaseVersion: null,
        before: current.apps,
        after: next.apps,
        metadata: { version: next.version, appCount: next.apps.length },
      });
    }
    if (input.links) {
      next.links = input.links.map((link) => ({ ...link }));
      audit.push({
        action: 'links.updated',
        actor: input.actor,
        summary: `Updated ${next.links.length} navigation ${
          next.links.length === 1 ? 'link' : 'links'
        }`,
        reason,
        releaseVersion: null,
        before: current.links,
        after: next.links,
        metadata: { linkCount: next.links.length },
      });
    }
    if (audit.length === 0) {
      throw new BadRequestException('Nothing to save');
    }
    await this.store.saveDraft(next, audit);
    return this.bundle(next, await this.store.listReleases());
  }

  async publish(
    input: RegistryActor & {
      releaseNotes: string;
      changeSummary?: string;
      reason?: string;
      source: RegistrySourceSnapshot;
    }
  ): Promise<RegistryReleaseBundle> {
    if (!input.releaseNotes?.trim()) {
      throw new BadRequestException('Release notes are required');
    }
    const working = await this.requireWorking();
    const releases = await this.store.listReleases();
    const version = (releases[0]?.version ?? 0) + 1;
    const release: ReleaseRecord = {
      version,
      isCurrent: true,
      snapshot: this.toSnapshot(working),
      releaseNotes: input.releaseNotes.trim(),
      changeSummary: input.changeSummary?.trim() || null,
      sourceHash: hashSnapshot(this.requireSource(input.source)),
      restoredFromVersion: null,
      publishedAt: new Date(),
      publishedBy: input.actor,
    };
    const previous = releases.find((entry) => entry.isCurrent);
    await this.store.saveRelease(release, null, {
      action: 'publish',
      actor: input.actor,
      summary: `Published registry release v${version}`,
      reason: input.reason?.trim() || release.releaseNotes,
      releaseVersion: version,
      before: previous?.snapshot ?? null,
      after: release.snapshot,
      metadata: { version, appCount: working.apps.length },
    });
    return this.bundle(working, await this.store.listReleases());
  }

  async rollback(
    input: RegistryActor & {
      version: number;
      releaseNotes?: string;
      reason?: string;
      source: RegistrySourceSnapshot;
    }
  ): Promise<RegistryReleaseBundle> {
    const releases = await this.store.listReleases();
    const target = releases.find((entry) => entry.version === input.version);
    if (!target) {
      throw new NotFoundException(
        `Registry release ${input.version} was not found`
      );
    }
    const reason = input.reason?.trim() || input.releaseNotes?.trim() || null;
    const version = releases[0].version + 1;
    const working = this.clone(this.toWorkingFromSnapshot(target));
    const release: ReleaseRecord = {
      version,
      isCurrent: true,
      snapshot: this.clone(target.snapshot),
      releaseNotes: reason ?? `Rolled back to v${target.version}`,
      changeSummary: `Rollback to v${target.version}`,
      sourceHash: hashSnapshot(this.requireSource(input.source)),
      restoredFromVersion: target.version,
      publishedAt: new Date(),
      publishedBy: input.actor,
    };
    const previous = releases.find((entry) => entry.isCurrent);
    await this.store.saveRelease(release, working, {
      action: 'rollback',
      actor: input.actor,
      summary: `Rolled registry back to release v${target.version}`,
      reason,
      releaseVersion: version,
      before: previous?.snapshot ?? null,
      after: release.snapshot,
      metadata: { version, restoredFromVersion: target.version },
    });
    return this.bundle(working, await this.store.listReleases());
  }

  async auditList(
    input: { limit?: number } = {}
  ): Promise<RegistryAuditRecord[]> {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
    const rows = await this.store.listAudit(limit);
    return rows.map((row) => ({
      id: row.id as number,
      occurredAt: (row.createdAt ?? new Date()).toISOString(),
      action: row.action === 'links.updated' ? 'links.updated' : 'apps.updated',
      event: row.action,
      summary: row.summary,
      actor: row.actor,
      reason: row.reason ?? undefined,
      releaseVersion: row.releaseVersion ?? undefined,
      metadata: row.metadata,
    }));
  }

  async drift(input: {
    source: RegistrySourceSnapshot;
  }): Promise<RegistryDriftReport> {
    const source = this.requireSource(input.source);
    const releases = await this.store.listReleases();
    const current = releases.find((entry) => entry.isCurrent);
    const sourceHash = hashSnapshot(source);
    if (!current) {
      return {
        state: 'yaml-changed',
        sourceHash,
        publishedHash: null,
        publishedVersion: null,
        changedApps: [],
        addedInDatabase: [],
        missingFromDatabase: source.registry.apps.map((app) => app.appId),
        hasUnpublishedChanges: false,
      };
    }
    const published = this.asSource(current);
    const publishedHash = hashSnapshot(published);
    const working = await this.store.loadWorking();
    const state = this.driftState(
      sourceHash,
      publishedHash,
      current.sourceHash
    );

    const yamlApps = new Map(
      source.registry.apps.map((app) => [app.appId, normalizeApp(app)])
    );
    const dbApps = new Map(
      published.registry.apps.map((app) => [app.appId, normalizeApp(app)])
    );
    return {
      state,
      sourceHash,
      publishedHash,
      publishedVersion: current.version,
      changedApps: [...dbApps.keys()].filter(
        (id) =>
          yamlApps.has(id) &&
          JSON.stringify(yamlApps.get(id)) !== JSON.stringify(dbApps.get(id))
      ),
      addedInDatabase: [...dbApps.keys()].filter((id) => !yamlApps.has(id)),
      missingFromDatabase: [...yamlApps.keys()].filter((id) => !dbApps.has(id)),
      hasUnpublishedChanges: working
        ? !snapshotsEqual(this.asSource(current), this.workingAsSource(working))
        : false,
    };
  }

  async exportYaml(input: {
    source: RegistrySourceSnapshot;
  }): Promise<RegistryYamlExport> {
    const source = this.requireSource(input.source);
    const releases = await this.store.listReleases();
    const current = releases.find((entry) => entry.isCurrent);
    const working = await this.store.loadWorking();
    const published: RegistrySourceSnapshot | null = current
      ? this.asSource(current)
      : working
      ? this.workingAsSource(working)
      : null;
    if (!published) {
      throw new NotFoundException('The registry has not been seeded yet');
    }
    const yaml = toRegistryYaml(published.registry);
    const deployedYaml = toRegistryYaml(source.registry);
    // generatedAt moves on every save; it is not a change worth a diff.
    const strip = (text: string) =>
      text
        .split('\n')
        .filter((line) => !line.startsWith('generatedAt:'))
        .join('\n');
    const diff = unifiedDiff(strip(deployedYaml), strip(yaml));
    return {
      yaml,
      deployedYaml,
      diff,
      identical: diff === '',
      publishedVersion: current?.version ?? null,
      linksNotInYaml: published.links.length,
    };
  }

  private driftState(
    sourceHash: string,
    publishedHash: string,
    releaseSourceHash: string | null
  ): RegistryDriftState {
    if (sourceHash === publishedHash) {
      return 'in-sync';
    }
    // `releaseSourceHash` is the YAML as it stood when the live release went
    // out, so it separates "the YAML moved" from "the database moved".
    const yamlChanged = releaseSourceHash !== sourceHash;
    const dbAhead = releaseSourceHash !== publishedHash;
    if (yamlChanged && dbAhead) return 'both';
    return yamlChanged ? 'yaml-changed' : 'db-ahead';
  }

  private bundle(
    working: WorkingRegistry,
    releases: ReleaseRecord[]
  ): RegistryReleaseBundle {
    const registry = {
      version: working.version,
      generatedAt: working.generatedAt,
      apps: working.apps,
    };
    const current = releases.find((entry) => entry.isCurrent);
    const history: RegistryReleaseRevision[] = releases.map((entry) => ({
      version: entry.version,
      status: 'published',
      publishedAt: entry.publishedAt.toISOString(),
      releasedAt: entry.publishedAt.toISOString(),
      releaseNotes: entry.releaseNotes,
      changeSummary: entry.changeSummary ?? undefined,
      snapshot: this.clone(entry.snapshot),
    }));
    const release: RegistryReleaseState = {
      status: !current
        ? 'draft'
        : snapshotsEqual(this.asSource(current), this.workingAsSource(working))
        ? 'published'
        : 'changes-pending',
      previewUrl: registry.apps.find((app) => app.visibility === 'public')
        ?.uiBaseUrl,
      publishedVersion: current?.version,
      publishedAt: current?.publishedAt.toISOString(),
      releaseNotes: current?.releaseNotes,
      changeSummary: current?.changeSummary ?? undefined,
      history,
    };
    return { registry, links: working.links, release };
  }

  private async requireWorking(): Promise<WorkingRegistry> {
    const working = await this.store.loadWorking();
    if (!working) {
      throw new NotFoundException('The registry has not been seeded yet');
    }
    return working;
  }

  private requireSource(
    source: RegistrySourceSnapshot | undefined
  ): RegistrySourceSnapshot {
    if (!source?.registry || !Array.isArray(source.registry.apps)) {
      throw new BadRequestException('The deployed registry source is required');
    }
    return { registry: source.registry, links: source.links ?? [] };
  }

  private toWorking(source: RegistrySourceSnapshot): WorkingRegistry {
    return this.clone({
      version: source.registry.version,
      generatedAt: source.registry.generatedAt,
      apps: source.registry.apps,
      links: source.links,
    });
  }

  private toWorkingFromSnapshot(release: ReleaseRecord): WorkingRegistry {
    return {
      version: release.snapshot.registry.version,
      generatedAt: release.snapshot.registry.generatedAt,
      apps: release.snapshot.registry.apps,
      links: release.snapshot.links,
    };
  }

  private toSnapshot(working: WorkingRegistry): ReleaseRecord['snapshot'] {
    return this.clone({
      registry: {
        version: working.version,
        generatedAt: working.generatedAt,
        apps: working.apps,
      },
      links: working.links,
    });
  }

  private asSource(release: ReleaseRecord): RegistrySourceSnapshot {
    return release.snapshot;
  }

  private workingAsSource(working: WorkingRegistry): RegistrySourceSnapshot {
    return this.toSnapshot(working);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
