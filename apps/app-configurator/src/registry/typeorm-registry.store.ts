import { DataSource, EntityManager } from 'typeorm';
import type {
  AppRegistration,
  NavigationLink,
} from '@optimistic-tanuki/app-registry-backend';
import { RegistryAuditEntity } from './entities/registry-audit.entity';
import { RegistryEntryEntity } from './entities/registry-entry.entity';
import { RegistryReleaseEntity } from './entities/registry-release.entity';
import {
  AuditRecord,
  RegistryStore,
  ReleaseRecord,
  WorkingRegistry,
} from './registry.store';

const META_KEY = 'registry';

export class TypeOrmRegistryStore implements RegistryStore {
  constructor(private readonly dataSource: DataSource) {}

  async loadWorking(): Promise<WorkingRegistry | null> {
    const rows = await this.dataSource
      .getRepository(RegistryEntryEntity)
      .find({ order: { position: 'ASC' } });
    const meta = rows.find((row) => row.kind === 'meta');
    if (!meta) {
      return null;
    }
    return {
      version: String(meta.definition['version']),
      generatedAt: String(meta.definition['generatedAt']),
      apps: rows
        .filter((row) => row.kind === 'app')
        .map((row) => row.definition as unknown as AppRegistration),
      links: rows
        .filter((row) => row.kind === 'link')
        .map((row) => row.definition as unknown as NavigationLink),
    };
  }

  async listReleases(): Promise<ReleaseRecord[]> {
    const rows = await this.dataSource
      .getRepository(RegistryReleaseEntity)
      .find({ order: { version: 'DESC' } });
    return rows.map((row) => ({
      version: row.version,
      isCurrent: row.isCurrent,
      snapshot: row.snapshot as unknown as ReleaseRecord['snapshot'],
      releaseNotes: row.releaseNotes,
      changeSummary: row.changeSummary,
      sourceHash: row.sourceHash,
      restoredFromVersion: row.restoredFromVersion,
      publishedAt: row.publishedAt ?? row.createdAt,
      publishedBy: row.publishedBy ?? 'unknown',
    }));
  }

  async listAudit(limit: number): Promise<AuditRecord[]> {
    const rows = await this.dataSource
      .getRepository(RegistryAuditEntity)
      .find({ order: { id: 'DESC' }, take: limit });
    return rows.map((row) => ({
      id: row.id,
      action: row.action as AuditRecord['action'],
      actor: row.actor,
      summary: row.summary,
      reason: row.reason,
      releaseVersion: row.releaseVersion,
      before: row.before,
      after: row.after,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));
  }

  async seed(
    working: WorkingRegistry,
    release: ReleaseRecord,
    audit: AuditRecord
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // Serialise concurrent boots so only one instance seeds.
      await manager.query('LOCK TABLE registry_release IN EXCLUSIVE MODE');
      if ((await manager.count(RegistryReleaseEntity)) > 0) {
        return false;
      }
      await this.writeWorking(manager, working);
      await this.writeRelease(manager, release);
      await this.writeAudit(manager, audit);
      return true;
    });
  }

  async saveDraft(
    working: WorkingRegistry,
    audit: AuditRecord[]
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.writeWorking(manager, working);
      for (const row of audit) {
        await this.writeAudit(manager, row);
      }
    });
  }

  async saveRelease(
    release: ReleaseRecord,
    working: WorkingRegistry | null,
    audit: AuditRecord
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        RegistryReleaseEntity,
        { isCurrent: true },
        { isCurrent: false }
      );
      await this.writeRelease(manager, release);
      if (working) {
        await this.writeWorking(manager, working);
      }
      await this.writeAudit(manager, audit);
    });
  }

  private async writeWorking(
    manager: EntityManager,
    working: WorkingRegistry
  ): Promise<void> {
    await manager.delete(RegistryEntryEntity, {});
    const rows: Partial<RegistryEntryEntity>[] = [
      {
        kind: 'meta',
        key: META_KEY,
        definition: {
          version: working.version,
          generatedAt: working.generatedAt,
        },
        position: 0,
      },
      ...working.apps.map((app, position) => ({
        kind: 'app' as const,
        key: app.appId,
        definition: app as unknown as Record<string, unknown>,
        position,
      })),
      ...working.links.map((link, position) => ({
        kind: 'link' as const,
        key: link.linkId,
        definition: link as unknown as Record<string, unknown>,
        position,
      })),
    ];
    await manager.insert(RegistryEntryEntity, rows);
  }

  private async writeRelease(
    manager: EntityManager,
    release: ReleaseRecord
  ): Promise<void> {
    await manager.insert(RegistryReleaseEntity, {
      version: release.version,
      status: 'published',
      isCurrent: release.isCurrent,
      snapshot: release.snapshot as unknown as Record<string, unknown>,
      releaseNotes: release.releaseNotes,
      changeSummary: release.changeSummary,
      sourceHash: release.sourceHash,
      restoredFromVersion: release.restoredFromVersion,
      publishedAt: release.publishedAt,
      publishedBy: release.publishedBy,
    });
  }

  private async writeAudit(
    manager: EntityManager,
    audit: AuditRecord
  ): Promise<void> {
    await manager.insert(RegistryAuditEntity, {
      action: audit.action,
      actor: audit.actor,
      summary: audit.summary,
      reason: audit.reason,
      releaseVersion: audit.releaseVersion,
      before: audit.before,
      after: audit.after,
      metadata: audit.metadata,
    });
  }
}
