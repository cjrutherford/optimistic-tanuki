import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  AppRegistration,
  NavigationLink,
  RegistrySourceSnapshot,
} from '@optimistic-tanuki/app-registry-backend';
import { RegistryService, YAML_SEED_ACTOR } from './registry.service';
import {
  AuditRecord,
  RegistryStore,
  ReleaseRecord,
  WorkingRegistry,
} from './registry.store';
import { unifiedDiff } from './registry-yaml';

class InMemoryRegistryStore implements RegistryStore {
  working: WorkingRegistry | null = null;
  releases: ReleaseRecord[] = [];
  audit: AuditRecord[] = [];

  async loadWorking() {
    return this.working ? JSON.parse(JSON.stringify(this.working)) : null;
  }
  async listReleases() {
    return [...this.releases].sort((a, b) => b.version - a.version);
  }
  async listAudit(limit: number) {
    return [...this.audit].reverse().slice(0, limit);
  }
  async seed(w: WorkingRegistry, r: ReleaseRecord, a: AuditRecord) {
    if (this.releases.length) return false;
    this.working = w;
    this.releases.push(r);
    this.push(a);
    return true;
  }
  async saveDraft(w: WorkingRegistry, a: AuditRecord[]) {
    this.working = w;
    a.forEach((row) => this.push(row));
  }
  async saveRelease(
    r: ReleaseRecord,
    w: WorkingRegistry | null,
    a: AuditRecord
  ) {
    this.releases.forEach((x) => (x.isCurrent = false));
    this.releases.push(r);
    if (w) this.working = w;
    this.push(a);
  }
  private push(row: AuditRecord) {
    this.audit.push({
      ...row,
      id: this.audit.length + 1,
      createdAt: new Date(),
    });
  }
}

const app = (appId: string, extra: Partial<AppRegistration> = {}) =>
  ({
    appId,
    name: appId,
    domain: 'localhost',
    uiBaseUrl: 'http://localhost:8080',
    apiBaseUrl: 'http://localhost:3300',
    appType: 'client',
    visibility: 'public',
    ...extra,
  } as AppRegistration);

const link = (id: string): NavigationLink => ({
  linkId: id,
  sourceAppId: 'hai',
  targetAppId: 'store',
  type: 'nav',
  label: id,
});

const source = (apps = [app('hai'), app('store')]): RegistrySourceSnapshot => ({
  registry: { version: '1.0.0', generatedAt: '2026-01-01T00:00:00Z', apps },
  links: [link('a')],
});

describe('RegistryService', () => {
  let store: InMemoryRegistryStore;
  let service: RegistryService;

  beforeEach(() => {
    store = new InMemoryRegistryStore();
    service = new RegistryService(store);
  });

  describe('seeding', () => {
    it('imports the YAML as published version 1 by yaml-seed', async () => {
      await expect(service.seed({ source: source() })).resolves.toEqual({
        seeded: true,
        version: 1,
      });
      const bundle = await service.get();
      expect(bundle?.registry.apps.map((a) => a.appId)).toEqual([
        'hai',
        'store',
      ]);
      expect(bundle?.release.publishedVersion).toBe(1);
      expect(bundle?.release.status).toBe('published');
      expect(store.releases[0].publishedBy).toBe(YAML_SEED_ACTOR);
      expect(store.audit[0]).toMatchObject({
        action: 'seed',
        actor: YAML_SEED_ACTOR,
      });
    });

    it('never re-seeds, even when the YAML changed', async () => {
      await service.seed({ source: source() });
      await service.saveDraft({
        actor: 'owner',
        registry: { ...source().registry, apps: [app('hai')] },
      });
      const result = await service.seed({
        source: source([app('hai'), app('store'), app('extra')]),
      });
      expect(result).toEqual({ seeded: false, version: 1 });
      expect(store.releases).toHaveLength(1);
      expect(store.audit.filter((a) => a.action === 'seed')).toHaveLength(1);
      expect((await service.get())?.registry.apps).toHaveLength(1);
    });

    it('returns null before seeding', async () => {
      await expect(service.get()).resolves.toBeNull();
      await expect(
        service.saveDraft({ actor: 'o', links: [] })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('drafts, publish and rollback', () => {
    beforeEach(async () => {
      await service.seed({ source: source() });
    });

    it('marks edits as changes-pending and audits them with the actor', async () => {
      const bundle = await service.saveDraft({
        actor: 'owner-1',
        registry: {
          ...source().registry,
          apps: [app('hai'), app('store'), app('new')],
        },
        reason: 'adding an app',
      });
      expect(bundle.release.status).toBe('changes-pending');
      const rows = await service.auditList();
      expect(rows[0]).toMatchObject({
        action: 'apps.updated',
        event: 'apps.updated',
        actor: 'owner-1',
        reason: 'adding an app',
      });
    });

    it('publishes the next version and stores the reason', async () => {
      await service.saveDraft({
        actor: 'o',
        links: [link('a'), link('b')],
      });
      const bundle = await service.publish({
        actor: 'owner-1',
        releaseNotes: 'two links',
        reason: 'launch',
        source: source(),
      });
      expect(bundle.release.publishedVersion).toBe(2);
      expect(bundle.release.status).toBe('published');
      expect(bundle.release.history.map((h) => h.version)).toEqual([2, 1]);
      const [row] = await service.auditList();
      expect(row).toMatchObject({
        event: 'publish',
        action: 'apps.updated',
        actor: 'owner-1',
        reason: 'launch',
        releaseVersion: 2,
      });
    });

    it('requires release notes', async () => {
      await expect(
        service.publish({
          actor: 'o',
          releaseNotes: '  ',
          source: source(),
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rolls back by restoring the snapshot as a new release', async () => {
      await service.saveDraft({ actor: 'o', links: [link('a'), link('b')] });
      await service.publish({
        actor: 'o',
        releaseNotes: 'v2',
        source: source(),
      });
      const bundle = await service.rollback({
        actor: 'owner-2',
        version: 1,
        reason: 'bad links',
        source: source(),
      });
      expect(bundle.links.map((l) => l.linkId)).toEqual(['a']);
      expect(bundle.release.publishedVersion).toBe(3);
      expect(bundle.release.history.map((h) => h.version)).toEqual([3, 2, 1]);
      expect(store.releases.filter((r) => r.isCurrent)).toHaveLength(1);
      expect(store.releases.find((r) => r.version === 3)).toMatchObject({
        restoredFromVersion: 1,
      });
      expect((await service.auditList())[0]).toMatchObject({
        event: 'rollback',
        actor: 'owner-2',
        reason: 'bad links',
      });
      // The next publish keeps counting up instead of reusing a version.
      const next = await service.publish({
        actor: 'o',
        releaseNotes: 'again',
        source: source(),
      });
      expect(next.release.publishedVersion).toBe(4);
    });

    it('rejects a rollback to an unknown version', async () => {
      await expect(
        service.rollback({ actor: 'o', version: 9, source: source() })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('drift', () => {
    beforeEach(async () => {
      await service.seed({ source: source() });
    });

    it('is in-sync right after seeding', async () => {
      const report = await service.drift({ source: source() });
      expect(report).toMatchObject({
        state: 'in-sync',
        publishedVersion: 1,
        hasUnpublishedChanges: false,
      });
    });

    it('ignores timestamps and fields the YAML cannot express', async () => {
      const noisy = source([
        app('hai', { updatedAt: 'x', features: { a: true } }),
        app('store'),
      ]);
      noisy.registry.generatedAt = '2030-01-01T00:00:00Z';
      expect((await service.drift({ source: noisy })).state).toBe('in-sync');
    });

    it('reports db-ahead after a console publish', async () => {
      await service.saveDraft({
        actor: 'o',
        registry: {
          ...source().registry,
          apps: [app('hai', { name: 'Renamed' }), app('store'), app('new')],
        },
      });
      await service.publish({
        actor: 'o',
        releaseNotes: 'n',
        source: source(),
      });
      const report = await service.drift({ source: source() });
      expect(report.state).toBe('db-ahead');
      expect(report.changedApps).toEqual(['hai']);
      expect(report.addedInDatabase).toEqual(['new']);
    });

    it('reports yaml-changed when only the YAML moved', async () => {
      const report = await service.drift({
        source: source([app('hai'), app('store'), app('yaml-new')]),
      });
      expect(report.state).toBe('yaml-changed');
      expect(report.missingFromDatabase).toEqual(['yaml-new']);
    });

    it('reports both when each side moved', async () => {
      await service.saveDraft({
        actor: 'o',
        registry: { ...source().registry, apps: [app('hai')] },
      });
      await service.publish({
        actor: 'o',
        releaseNotes: 'n',
        source: source(),
      });
      const report = await service.drift({
        source: source([app('hai'), app('store'), app('yaml-new')]),
      });
      expect(report.state).toBe('both');
    });

    it('returns to in-sync once the YAML adopts the published registry', async () => {
      const edited = [app('hai'), app('store'), app('new')];
      await service.saveDraft({
        actor: 'o',
        registry: { ...source().registry, apps: edited },
      });
      await service.publish({
        actor: 'o',
        releaseNotes: 'n',
        source: source(),
      });
      expect((await service.drift({ source: source(edited) })).state).toBe(
        'in-sync'
      );
    });

    it('flags unpublished draft edits', async () => {
      await service.saveDraft({ actor: 'o', links: [] });
      expect(
        (await service.drift({ source: source() })).hasUnpublishedChanges
      ).toBe(true);
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      await service.seed({ source: source() });
    });

    it('exports the published registry as YAML without links', async () => {
      const out = await service.exportYaml({ source: source() });
      expect(out.yaml).toContain('appId: hai');
      expect(out.yaml).not.toContain('updatedAt');
      expect(out.identical).toBe(true);
      expect(out.diff).toBe('');
      expect(out.linksNotInYaml).toBe(1);
      expect(out.publishedVersion).toBe(1);
    });

    it('diffs against the deployed YAML and ignores generatedAt', async () => {
      await service.saveDraft({
        actor: 'o',
        registry: {
          version: '1.0.0',
          generatedAt: '2031-01-01T00:00:00Z',
          apps: [app('hai', { name: 'Renamed' }), app('store')],
        },
      });
      await service.publish({
        actor: 'o',
        releaseNotes: 'n',
        source: source(),
      });
      const out = await service.exportYaml({ source: source() });
      expect(out.identical).toBe(false);
      expect(out.diff).toContain('--- deployed/apps.yaml');
      expect(out.diff).toContain('-    name: hai');
      expect(out.diff).toContain('+    name: Renamed');
      expect(out.diff).not.toContain('generatedAt');
    });
  });
});

describe('unifiedDiff', () => {
  it('is empty for equal text and shows hunks otherwise', () => {
    expect(unifiedDiff('a\nb\n', 'a\nb\n')).toBe('');
    const diff = unifiedDiff('a\nb\nc\n', 'a\nB\nc\n');
    expect(diff).toContain('@@ -1,4 +1,4 @@');
    expect(diff).toContain('-b');
    expect(diff).toContain('+B');
  });
});
