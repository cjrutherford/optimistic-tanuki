import { DataSource } from 'typeorm';
import { join } from 'node:path';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { loadLocalityRegistry } from '../../src/locality-registry.js';
import { createTestSchema, withTestDataSource } from './helpers/postgres.js';
import { projectItems, projectStories } from '../../src/edition.js';
import {
  brief,
  collate,
  developStories,
  loadProjectedStories,
  validateAgendaHeadingAgainstSource,
} from '../../src/pipeline.js';
import {
  ALL_SCHEMAS,
  CivicItemSchema,
  AgendaItemSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  CanonicalStoryRevisionSchema,
  EditionItemSchema,
  EditionStorySchema,
  SourceSchema,
  StoryRevisionCitationSchema,
} from '../../src/schema.js';

const registry = loadLocalityRegistry(
  join(__dirname, '..', 'fixtures', 'localities-snapshot')
);
const V1 = registry.ruleVersion('adel-ga');
const V2 = `${V1}-next`;

function item(input: Partial<Record<string, unknown>> = {}) {
  return {
    sourceId: 'cook-news-discover',
    localitySlug: 'cook-county-ga',
    scopeSlug: 'cook-county-ga',
    scopeKind: 'county',
    kind: 'news',
    title: 'Adel bridge project',
    body: 'Adel, Ga. bridge project update with enough detail.',
    summary: null,
    publishedAt: '2026-09-12T10:00:00.000Z',
    eventDate: null,
    topics: JSON.stringify(['roads']),
    uris: JSON.stringify(['https://example.test/story']),
    hash: `hash-${Math.random()}`,
    createdAt: '2026-09-12T10:00:00.000Z',
    geographyDecision: null,
    geographyEvidence: null,
    ruleVersion: null,
    originalSnippet: null,
    publisher: null,
    canonicalUrl: null,
    articleProvenance: null,
    contentChecksum: null,
    ...input,
  };
}

describe('town edition projections', () => {
  it('validates agenda timeline headings against original CivicItem evidence', () => {
    const source = {
      title: 'Agenda 09/08/2026',
      body: 'City Council Workshop. Resolution Approving the housing plan is listed for consideration.',
    };
    expect(() =>
      validateAgendaHeadingAgainstSource(
        'Town Hall — housing plan approved',
        source
      )
    ).toThrow(/event type|outcome/i);
    expect(() =>
      validateAgendaHeadingAgainstSource(
        'Council Workshop — housing plan approved',
        source
      )
    ).toThrow(/outcome/i);
    expect(() =>
      validateAgendaHeadingAgainstSource(
        'Council Workshop — Resolution Approving the housing plan',
        source
      )
    ).not.toThrow();
    expect(() =>
      validateAgendaHeadingAgainstSource(
        'Council Workshop — housing plan approved',
        {
          ...source,
          body: 'City Council Workshop. The council approved the housing plan.',
        }
      )
    ).not.toThrow();
  });

  it('rejects occurrence headings from future/listed agendas but permits source-supported minutes', () => {
    const agenda = {
      title: 'City Council Agenda 09/08/2026',
      body: 'The council meeting will be conducted on September 8. The agenda lists a proposed zoning application.',
    };
    expect(() =>
      validateAgendaHeadingAgainstSource('The council met', agenda)
    ).toThrow(/occurrence|agenda/i);
    expect(() =>
      validateAgendaHeadingAgainstSource('The meeting was held', agenda)
    ).toThrow(/occurrence|agenda/i);
    expect(() =>
      validateAgendaHeadingAgainstSource(
        'Meeting scheduled for September 8',
        agenda
      )
    ).not.toThrow();
    expect(() =>
      validateAgendaHeadingAgainstSource('The council met', {
        title: 'Council Minutes 09/08/2026',
        body: 'The council met and approved the zoning application.',
      })
    ).not.toThrow();
  });

  it('withholds unresolved canonical scope without creating a story or edition row', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save(
        item({
          scopeSlug: null,
          localitySlug: 'adel-ga',
          title: 'Unresolved source item',
          hash: 'unresolved-scope',
        })
      );
      const result = await projectItems(ds, 'adel-ga', registry);
      expect(result.diagnostics[0]?.decision).toBe('withhold');
      expect(result.diagnostics[0]?.evidence.reason).toBe(
        'canonical scope is unresolved'
      );
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(0);
      expect(await ds.getRepository(EditionItemSchema).count()).toBe(0);
    });
  });

  it('projects only included canonical items, retains diagnostics, and keeps towns isolated', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save([
        item({
          sourceId: 'cook-news-discover',
          scopeSlug: 'cook-county-ga',
          title: 'Adel bridge project',
          hash: 'include',
        }),
        item({
          sourceId: 'cook-news-discover',
          scopeSlug: 'cook-county-ga',
          title: 'Sparks zoning hearing',
          body: 'Sparks, Ga. zoning hearing scheduled.',
          hash: 'other-town',
        }),
        item({
          sourceId: 'berrien-press',
          localitySlug: 'berrien-county-ga',
          scopeSlug: 'berrien-county-ga',
          title: 'Alapaha road update',
          body: 'Alapaha, Ga. road update.',
          hash: 'other-county',
        }),
      ]);
      const result = await projectItems(ds, 'adel-ga', registry);
      expect(result.included.length).toBe(1);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.decision).toBe('withhold');
      expect(await ds.getRepository(EditionItemSchema).count()).toBe(1);
      expect(
        (await ds.getRepository(EditionItemSchema).find())[0]?.localitySlug
      ).toBe('adel-ga');
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(1);
      expect(
        (await projectItems(ds, 'nashville-ga', registry)).included.length
      ).toBe(0);
      expect(await ds.getRepository(EditionItemSchema).count()).toBe(1);
    });
  });

  it('does not mutate canonical civic geography when projecting multiple targets', async () => {
    await withTestDataSource(async (ds) => {
      await ds
        .getRepository(CivicItemSchema)
        .save(item({ hash: 'shared-facts', scopeSlug: 'cook-county-ga' }));
      const before = await ds
        .getRepository(CivicItemSchema)
        .findOneBy({ hash: 'shared-facts' });
      if (!before) throw new Error('expected before');
      await projectItems(ds, 'adel-ga', registry);
      await projectItems(ds, 'nashville-ga', registry);
      const after = await ds
        .getRepository(CivicItemSchema)
        .findOneBy({ hash: 'shared-facts' });
      expect({
        geographyDecision: after?.geographyDecision,
        geographyEvidence: after?.geographyEvidence,
        ruleVersion: after?.ruleVersion,
      }).toStrictEqual({
        geographyDecision: before.geographyDecision,
        geographyEvidence: before.geographyEvidence,
        ruleVersion: before.ruleVersion,
      });
    });
  });

  it('creates one canonical story per scope identity and projects only included stories idempotently', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save([
        item({
          sourceId: 'cook-news-discover',
          scopeSlug: 'cook-county-ga',
          title: 'Adel bridge project',
          canonicalUrl: 'https://publisher.test/bridge',
          hash: 'story-a',
        }),
        item({
          sourceId: 'cook-news-discover',
          scopeSlug: 'cook-county-ga',
          title: 'Bridge project follow-up',
          canonicalUrl: 'https://publisher.test/bridge/',
          hash: 'story-b',
        }),
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const stories = await projectStories(ds, 'adel-ga', V1);
      expect(stories.length).toBe(1);
      expect(await ds.getRepository(CanonicalStoryItemSchema).count()).toBe(2);
      expect(await ds.getRepository(EditionStorySchema).count()).toBe(1);
      expect((await projectStories(ds, 'adel-ga', V1)).length).toBe(1);
      expect(await ds.getRepository(EditionStorySchema).count()).toBe(1);
      expect((await projectStories(ds, 'adel-ga', V2)).length).toBe(0);
      const v1Projection = await ds.getRepository(EditionItemSchema).findOneBy({
        localitySlug: 'adel-ga',
        decision: 'include',
        ruleVersion: V1,
      });
      expect(v1Projection).toBeTruthy();
      await ds
        .getRepository(EditionItemSchema)
        .save({ ...v1Projection, id: undefined, ruleVersion: V2 });
      expect((await projectStories(ds, 'adel-ga', V2)).length).toBe(1);
      expect(await ds.getRepository(EditionStorySchema).count()).toBe(2);
    });
  });

  it('collates only included edition items, never raw civic intake rows', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save([
        item({
          scopeSlug: 'cook-county-ga',
          title: 'Included county road update',
          hash: 'included',
          topics: JSON.stringify(['roads']),
        }),
        item({
          scopeSlug: 'cook-county-ga',
          title: 'Unprojected raw item',
          hash: 'raw-only',
          topics: JSON.stringify(['roads']),
        }),
      ]);
      const [included] = await ds
        .getRepository(CivicItemSchema)
        .find({ where: { hash: 'included' } });
      await ds.getRepository(EditionItemSchema).save({
        localitySlug: 'adel-ga',
        civicItemId: included.id as number,
        decision: 'include',
        reason: 'county rule',
        ruleVersion: V1,
        createdAt: '2026-09-12T10:00:00.000Z',
      });
      const noVersionClusters = await collate(ds, 'adel-ga');
      expect(noVersionClusters).toStrictEqual([]);
      const clusters = await collate(ds, 'adel-ga', undefined, undefined, V1);
      expect(
        clusters.flatMap((cluster) => cluster.items.map((entry) => entry.title))
      ).toStrictEqual(['Included county road update']);
      const [rawOnly] = await ds
        .getRepository(CivicItemSchema)
        .find({ where: { hash: 'raw-only' } });
      await ds.getRepository(EditionItemSchema).save({
        localitySlug: 'adel-ga',
        civicItemId: rawOnly.id as number,
        decision: 'include',
        reason: 'new rules',
        ruleVersion: V2,
        createdAt: '2026-09-12T10:00:00.000Z',
      });
      const v2Clusters = await collate(ds, 'adel-ga', undefined, undefined, V2);
      expect(
        v2Clusters.flatMap((cluster) =>
          cluster.items.map((entry) => entry.title)
        )
      ).toStrictEqual(['Unprojected raw item']);
      const emptyBrief = await brief(
        ds,
        registry.get('adel-ga'),
        'daily',
        '2026-09-12',
        '2026-09-13',
        {
          model: 'test',
          summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
          tldr: async () => ({ bullets: [], model: 'test' }),
          summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
          developStory: async () => ({
            title: 'story',
            narrative: 'narrative',
            status: 'open',
            model: 'test',
          }),
        },
        undefined,
        0
      );
      expect(emptyBrief.markdown).not.toMatch(/Included county road update/);
    });
  });

  it('does not promote undated ingestion-time snippets into current evidence, but accepts observed notices', async () => {
    await withTestDataSource(async (ds) => {
      const [snippet, notice] = await ds.getRepository(CivicItemSchema).save([
        item({
          sourceId: 'school-board',
          kind: 'meeting',
          title:
            'Please have your child complete the following activities at home:',
          body: 'School information: Please have your child complete the following activities at home:',
          topics: null,
          eventDate: null,
          publishedAt: null,
          observedAt: null,
          createdAt: '2026-09-12T12:00:00.000Z',
          hash: 'undated-instructional-snippet',
        }),
        item({
          sourceId: 'school-board',
          kind: 'meeting',
          title: 'Board notice: maintenance work will begin next week',
          body: 'The official board notice says maintenance work will begin next week at the district office.',
          topics: JSON.stringify(['government']),
          eventDate: null,
          publishedAt: null,
          observedAt: '2026-09-12T12:00:00.000Z',
          createdAt: '2026-09-12T12:00:00.000Z',
          hash: 'observed-undated-notice',
        }),
      ]);
      await ds.getRepository(EditionItemSchema).save([
        {
          localitySlug: 'adel-ga',
          civicItemId: snippet.id as number,
          decision: 'include',
          reason: 'fixture',
          ruleVersion: V1,
          createdAt: '2026-09-12T12:00:00.000Z',
        },
        {
          localitySlug: 'adel-ga',
          civicItemId: notice.id as number,
          decision: 'include',
          reason: 'fixture',
          ruleVersion: V1,
          createdAt: '2026-09-12T12:00:00.000Z',
        },
      ]);
      const clusters = await collate(
        ds,
        'adel-ga',
        '2026-08-14',
        '2026-09-12',
        V1,
        'America/New_York',
        '2026-09-13',
        '2026-09-13'
      );
      expect(
        clusters.flatMap((cluster) => cluster.items.map((entry) => entry.title))
      ).toStrictEqual([notice.title]);
    });
  });

  it('does not expose withheld agenda text through threads or briefings', async () => {
    await withTestDataSource(async (ds) => {
      const [raw] = await ds.getRepository(CivicItemSchema).save([
        item({
          kind: 'meeting',
          localitySlug: 'adel-ga',
          scopeSlug: 'adel-ga',
          scopeKind: 'town',
          title: 'Withheld meeting',
          body: 'WITHHELD SECRET council discussion',
          hash: 'withheld-meeting',
        }),
      ]);
      await ds.getRepository(AgendaItemSchema).save({
        itemId: raw.id as number,
        localitySlug: 'adel-ga',
        meetingDate: '2026-09-12',
        section: 'General',
        ordinal: 1,
        heading: 'WITHHELD SECRET',
        body: 'WITHHELD SECRET council discussion',
        topicKey: 'topic:secret',
        procedural: false,
        createdAt: '2026-09-12T10:00:00.000Z',
      });
      await ds.getRepository(AgendaItemSchema).save({
        itemId: raw.id as number,
        localitySlug: 'adel-ga',
        meetingDate: '2026-09-13',
        section: 'General',
        ordinal: 1,
        heading: 'WITHHELD SECRET follow-up',
        body: 'WITHHELD SECRET council discussion continues',
        topicKey: 'topic:secret',
        procedural: false,
        createdAt: '2026-09-13T10:00:00.000Z',
      });
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'story',
          narrative: 'narrative',
          status: 'open',
          model: 'test',
        }),
      };
      const locality = { ...registry.get('adel-ga'), ruleVersion: V1 };
      const markdown = (
        await brief(
          ds,
          locality,
          'daily',
          '2026-09-12',
          '2026-09-13',
          summarizer,
          undefined,
          0
        )
      ).markdown;
      expect(markdown).not.toMatch(/WITHHELD SECRET/);
    });
  });

  it('links the same agenda topic on two dates into one story before developing it', async () => {
    await withTestDataSource(async (ds) => {
      const body = `Adel bridge project details ${'with a substantial public works update. '.repeat(
        12
      )}`;
      const [raw] = await ds.getRepository(CivicItemSchema).save([
        item({
          sourceId: 'adel-documents',
          localitySlug: 'adel-ga',
          scopeSlug: 'adel-ga',
          scopeKind: 'town',
          kind: 'meeting',
          title: 'Adel bridge project',
          body,
          canonicalUrl: 'https://adel.example/bridge',
          hash: 'canonical-story-once',
        }),
      ]);
      await ds.getRepository(AgendaItemSchema).save([
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-01',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel bridge project',
          body,
          topicKey: 'topic:bridge-project',
          procedural: false,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-15',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel bridge project update',
          body,
          topicKey: 'topic:bridge-project',
          procedural: false,
          createdAt: '2026-09-15T10:00:00.000Z',
        },
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'Adel bridge project',
          narrative: 'narrative',
          status: 'open',
          model: 'test',
        }),
      };
      await developStories(ds, registry.get('adel-ga'), summarizer);
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(1);
      const links = await ds
        .getRepository(CanonicalStoryItemSchema)
        .find({ order: { evidenceDate: 'ASC' } });
      expect(
        links.map((link) => [link.evidenceDate, link.matchReason])
      ).toStrictEqual([
        ['2026-09-01', 'opened'],
        ['2026-09-15', 'shared terms: bridge project, bridge, project'],
      ]);
    });
  });

  it('projects agenda siblings as isolated row evidence and rejects wrong-row quiet carry', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(SourceSchema).save({
        id: 'adel-documents',
        sourceKey: 'adel-documents',
        localitySlug: 'adel-ga',
        ownerSlug: 'adel-ga',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Adel documents',
        url: 'https://example.test/adel',
        kind: 'meeting',
        enabled: true,
      });
      const parentBody =
        'Agenda packet contains two independent matters. ' +
        'Context '.repeat(30);
      const parent = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'adel-documents',
        localitySlug: 'adel-ga',
        scopeSlug: 'adel-ga',
        scopeKind: 'town',
        kind: 'meeting',
        title: 'Agenda packet 08/24/2026',
        body: parentBody,
        canonicalUrl: 'https://example.test/adel/agenda',
        publishedAt: '2026-08-24T10:00:00.000Z',
        eventDate: null,
        topics: JSON.stringify(['agenda']),
        uris: JSON.stringify(['https://example.test/adel/agenda']),
        hash: 'agenda-sibling-isolation',
        createdAt: '2026-08-24T10:00:00.000Z',
        geographyDecision: 'include',
      });
      const agenda = await ds.getRepository(AgendaItemSchema).save([
        {
          itemId: parent.id!,
          localitySlug: 'adel-ga',
          meetingDate: '2026-08-24',
          section: 'Projects',
          ordinal: 1,
          heading: 'Road resurfacing project',
          body: 'Road resurfacing project is listed for discussion with a documented construction schedule and funding context.',
          topicKey: 'topic:road-resurfacing',
          procedural: false,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
        {
          itemId: parent.id!,
          localitySlug: 'adel-ga',
          meetingDate: '2026-08-24',
          section: 'Projects',
          ordinal: 2,
          heading: 'Water tank inspection',
          body: 'Water tank inspection is listed for discussion with a documented maintenance schedule and safety context.',
          topicKey: 'topic:water-tank',
          procedural: false,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const ruleVersion = V1;
      await projectStories(ds, 'adel-ga', ruleVersion);
      const links = await ds
        .getRepository(CanonicalStoryItemSchema)
        .find({ where: { civicItemId: parent.id! } });
      expect(links.length).toBe(2);
      expect(new Set(links.map((link) => link.agendaItemId))).toStrictEqual(
        new Set(agenda.map((row) => row.id))
      );
      const views = await loadProjectedStories(
        ds,
        'adel-ga',
        ruleVersion,
        'America/New_York'
      );
      const agendaViews = views.filter((view) =>
        view.items.some((item) => item.agendaItemId != null)
      );
      expect(agendaViews.length).toBe(2);
      expect(agendaViews.every((view) => view.items.length === 1)).toBe(true);
      expect(
        new Set(agendaViews.map((view) => view.items[0]!.agendaItemId))
      ).toStrictEqual(new Set(agenda.map((row) => row.id)));
      expect(
        agendaViews.some((view) =>
          view.items[0]!.body.includes('Road resurfacing')
        )
      ).toBeTruthy();
      expect(
        agendaViews.some((view) => view.items[0]!.body.includes('Water tank'))
      ).toBeTruthy();
      expect(
        agendaViews.every((view) => !view.items[0]!.body.includes(parentBody))
      ).toBeTruthy();

      const wrongView = agendaViews.find(
        (view) => view.items[0]!.agendaItemId === agenda[0]!.id
      )!;
      const rightView = agendaViews.find(
        (view) => view.items[0]!.agendaItemId === agenda[1]!.id
      )!;
      const now = '2026-08-25T00:00:00.000Z';
      const wrongRevision = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .save({
          canonicalStoryId: wrongView.story.id,
          revision: 1,
          status: 'successful',
          title: 'Wrong row story',
          titleOrigin: 'model',
          narrative: 'Wrong row narrative must not carry.',
          storyStatus: 'ongoing',
          generationId: null,
          inputSha256: 'a'.repeat(64),
          createdAt: now,
          artifactPath: null,
          artifactSha256: null,
          artifactToken: null,
        });
      const rightRevision = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .save({
          canonicalStoryId: rightView.story.id,
          revision: 1,
          status: 'successful',
          title: 'Water tank story',
          titleOrigin: 'model',
          narrative: 'Water tank narrative carries.',
          storyStatus: 'ongoing',
          generationId: null,
          inputSha256: 'b'.repeat(64),
          createdAt: now,
          artifactPath: null,
          artifactSha256: null,
          artifactToken: null,
        });
      await ds.getRepository(StoryRevisionCitationSchema).save([
        {
          revisionId: wrongRevision.id!,
          civicItemId: parent.id!,
          agendaItemId: agenda[1]!.id!,
          sourceKey: 'adel-documents',
          snippetOnly: false,
          createdAt: now,
        },
        {
          revisionId: rightRevision.id!,
          civicItemId: parent.id!,
          agendaItemId: agenda[1]!.id!,
          sourceKey: 'adel-documents',
          snippetOnly: false,
          createdAt: now,
        },
      ]);
      const result = await brief(
        ds,
        { ...registry.get('adel-ga'), ruleVersion },
        'daily',
        '2026-08-25',
        '2026-08-26',
        {
          model: 'deterministic-test',
          strict: false,
          summarizeCluster: async () => ({
            summary: 'unused',
            model: 'deterministic-test',
          }),
          tldr: async () => ({ bullets: [], model: 'deterministic-test' }),
          summarizeThread: async () => ({
            summary: 'unused',
            model: 'deterministic-test',
          }),
          developStory: async () => ({
            title: 'unused',
            narrative: 'unused',
            status: 'ongoing',
            model: 'deterministic-test',
          }),
        },
        undefined,
        0,
        [],
        join(tmpdir(), 'agenda-sibling-story-root'),
        join(tmpdir(), 'agenda-sibling.lock'),
        true,
        '2026-08-24',
        { start: '2026-08-24', end: '2026-08-25' },
        undefined,
        undefined,
        false,
        undefined,
        true
      );
      // A quiet day lists what is still open, each by its own agenda line — the
      // row a story's revision is bound to, never a sibling row's story.
      expect(result.markdown).toMatch(/Still open: “Water tank inspection/);
      expect(result.markdown).not.toMatch(/Road resurfacing/);
      expect(result.markdown).not.toMatch(/Wrong row narrative must not carry/);
    });
  });

  it('reports lone agenda lines under their meeting instead of rendering them as stories', async () => {
    await withTestDataSource(async (ds) => {
      const parent = await ds.getRepository(CivicItemSchema).save(
        item({
          sourceId: 'adel-documents',
          localitySlug: 'adel-ga',
          scopeSlug: 'adel-ga',
          scopeKind: 'town',
          kind: 'meeting',
          title: 'Agenda 09/12/2026',
          body: 'Agenda packet for the regular meeting. '.repeat(8),
          eventDate: '2026-09-12',
          canonicalUrl: 'https://adel.example/agenda-0912',
          hash: 'lone-agenda-lines',
        })
      );
      await ds.getRepository(AgendaItemSchema).save([
        {
          itemId: parent.id!,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-12',
          section: 'New Business',
          ordinal: 1,
          heading: '1. Sanitation Tipping Fee Increase',
          body: '1. Sanitation Tipping Fee Increase',
          topicKey: 'topic:sanitation-tipping-fee-increase',
          procedural: false,
          createdAt: '2026-09-12T10:00:00.000Z',
        },
        {
          itemId: parent.id!,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-12',
          section: 'New Business',
          ordinal: 2,
          heading: '2. Recovery Proclamation',
          body: '2. Recovery Proclamation',
          topicKey: 'topic:recovery-proclamation',
          procedural: false,
          createdAt: '2026-09-12T10:00:00.000Z',
        },
      ]);
      await ds.getRepository(CivicItemSchema).save([
        item({
          title: 'Adel bridge project',
          body: 'Adel, Ga. bridge project update with enough detail for residents.',
          publishedAt: '2026-09-12T10:00:00.000Z',
          hash: 'bridge-news-story',
        }),
      ]);
      await projectItems(ds, 'adel-ga', registry);
      await projectStories(ds, 'adel-ga', V1);
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'story',
          narrative: 'narrative',
          status: 'open',
          model: 'test',
        }),
      };
      const markdown = (
        await brief(
          ds,
          { ...registry.get('adel-ga'), ruleVersion: V1 },
          'daily',
          '2026-09-12',
          '2026-09-13',
          summarizer,
          undefined,
          0
        )
      ).markdown;
      // Without an article from the model, the news is still reported, cited: the
      // meeting with the lines on its agenda, and the article on its own.
      expect(markdown).toMatch(
        /Agenda 09\/12\/2026 \(Sept\. 12\) listed: Sanitation Tipping Fee Increase; Recovery Proclamation\. \[\\\[\d\\\]\]\(https:\/\/adel\.example\/agenda-0912\)/u
      );
      expect(markdown).not.toMatch(
        /### (?:1\. )?Sanitation Tipping Fee Increase|### (?:2\. )?Recovery Proclamation/u
      );
      expect(markdown).toMatch(/Adel bridge project \(Sept\. 12\)\./u);
      const body = markdown.split('## Sources')[0]!;
      expect(body.match(/Agenda 09\/12\/2026 \(Sept\. 12\)/gu)?.length).toBe(1);
    });
  });

  it('draws background only from canonical stories joined through the exact edition rule version', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save([
        item({
          title: 'Included projected story item',
          hash: 'brief-included',
          topics: JSON.stringify(['roads']),
        }),
        item({
          title: 'Included projected story item follow-up',
          hash: 'brief-included-earlier',
          publishedAt: '2026-09-05T10:00:00.000Z',
          topics: JSON.stringify(['roads']),
        }),
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const included = await ds
        .getRepository(CivicItemSchema)
        .findOneBy({ hash: 'brief-included' });
      if (!included) throw new Error('expected included');
      await projectStories(ds, 'adel-ga', V1);
      const linked = await ds
        .getRepository(CanonicalStoryItemSchema)
        .findOneBy({ civicItemId: included.id as number });
      if (!linked) throw new Error('expected linked');
      await ds
        .getRepository(CanonicalStorySchema)
        .update(
          { id: linked.canonicalStoryId },
          { title: 'INCLUDED CANONICAL STORY' }
        );
      await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'cook-county-ga',
        scopeKind: 'county',
        storyKey: 'cook-county-ga|news|title:unprojected',
        strategy: 'fallback',
        title: 'UNPROJECTED CANONICAL STORY',
        status: null,
        createdAt: '2026-09-12T10:00:00.000Z',
        updatedAt: '2026-09-12T10:00:00.000Z',
      });
      let briefInput:
        | {
            clusterSummaries: {
              evidence?: { title?: string; role?: string }[];
            }[];
          }
        | undefined;
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async (input: unknown) => {
          briefInput = input as typeof briefInput;
          return { bullets: [], model: 'test' };
        },
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'story',
          narrative: 'narrative',
          status: 'open',
          model: 'test',
        }),
      };
      const locality = { ...registry.get('adel-ga'), ruleVersion: V1 };
      const markdown = (
        await brief(
          ds,
          locality,
          'daily',
          '2026-09-12',
          '2026-09-13',
          summarizer,
          undefined,
          0
        )
      ).markdown;
      const evidence = briefInput!.clusterSummaries.flatMap(
        (summary) => summary.evidence ?? []
      );
      expect(
        evidence.some(
          (item) =>
            item.role === 'news' &&
            item.title === 'Included projected story item'
        )
      ).toBeTruthy();
      expect(
        evidence.some(
          (item) =>
            item.role === 'background' &&
            item.title === 'Included projected story item follow-up'
        )
      ).toBeTruthy();
      expect(markdown).not.toMatch(/UNPROJECTED CANONICAL STORY/);
    });
  });

  it('filters canonical story links through exact locality/version edition items', async () => {
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save([
        item({
          title: 'CASE CU-2026-90 included report',
          body: 'Included Adel, Ga. report details.',
          hash: 'case-included',
        }),
        item({
          title: 'CASE CU-2026-90 CASE-SECRET report',
          body: 'CASE-SECRET confidential Adel, Ga. details.',
          hash: 'case-secret',
        }),
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const secret = await ds
        .getRepository(CivicItemSchema)
        .findOneBy({ hash: 'case-secret' });
      if (!secret) throw new Error('expected secret');
      await ds.getRepository(EditionItemSchema).delete({
        localitySlug: 'adel-ga',
        civicItemId: secret.id as number,
        ruleVersion: V1,
      });
      await projectStories(ds, 'adel-ga', V1);
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'story',
          narrative: 'narrative',
          status: 'open',
          model: 'test',
        }),
      };
      const locality = { ...registry.get('adel-ga'), ruleVersion: V1 };
      const markdown = (
        await brief(
          ds,
          locality,
          'daily',
          '2026-09-12',
          '2026-09-13',
          summarizer,
          undefined,
          0
        )
      ).markdown;
      expect(markdown).toMatch(/CASE CU-2026-90 included report/);
      expect(markdown).not.toMatch(/CASE-SECRET/);
    });
  });

  it('uses the exact projection rule version for prior-briefing new-item lookup', async () => {
    await withTestDataSource(async (ds) => {
      const raw = await ds.getRepository(CivicItemSchema).save(
        item({
          title: 'Only v2 briefing item',
          hash: 'only-v2-briefing-item',
          createdAt: '2026-09-12T10:00:00.000Z',
        })
      );
      await projectItems(ds, 'adel-ga', registry);
      const v1 = await ds.getRepository(EditionItemSchema).findOneBy({
        localitySlug: 'adel-ga',
        civicItemId: raw.id as number,
        ruleVersion: V1,
      });
      expect(v1).toBeTruthy();
      await ds
        .getRepository(EditionItemSchema)
        .save({ ...v1, id: undefined, ruleVersion: V2 });
      await projectStories(ds, 'adel-ga', V2);
      await ds.getRepository('Briefing').save({
        localitySlug: 'adel-ga',
        cadence: 'daily',
        periodStart: '2026-09-11',
        periodEnd: '2026-09-12',
        markdown: 'old v1',
        itemIds: '[]',
        model: 'test',
        createdAt: '2026-09-13T10:00:00.000Z',
        ruleVersion: V1,
        runId: null,
      });
      const locality = { ...registry.get('adel-ga'), ruleVersion: V2 };
      const markdown = (
        await brief(
          ds,
          locality,
          'daily',
          '2026-09-12',
          '2026-09-13',
          {
            model: 'test',
            summarizeCluster: async () => ({
              summary: 'summary',
              model: 'test',
            }),
            tldr: async () => ({ bullets: [], model: 'test' }),
            summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
            developStory: async () => ({
              title: 'story',
              narrative: 'narrative',
              status: 'open',
              model: 'test',
            }),
          },
          undefined,
          0
        )
      ).markdown;
      expect(markdown).toMatch(/Only v2 briefing item/);
    });
  });

  it('rolls back canonical, link, and edition writes together on a database failure', async () => {
    await withTestDataSource(async (ds) => {
      await ds
        .getRepository(CivicItemSchema)
        .save(item({ hash: 'projection-failure' }));
      await ds.query(
        "CREATE FUNCTION fail_edition_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'projection failure'; END $$"
      );
      await ds.query(
        'CREATE TRIGGER fail_edition_projection BEFORE INSERT ON edition_items FOR EACH ROW EXECUTE FUNCTION fail_edition_projection()'
      );
      await expect(
        (() => projectItems(ds, 'adel-ga', registry))()
      ).rejects.toThrow(/projection failure/);
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(0);
      expect(await ds.getRepository(CanonicalStoryItemSchema).count()).toBe(0);
      expect(await ds.getRepository(EditionItemSchema).count()).toBe(0);
    });
  });

  it('is idempotent when two independent data sources project the same item concurrently', async () => {
    const { url } = await createTestSchema();
    const first = new DataSource({
      type: 'postgres',
      url,
      entities: ALL_SCHEMAS,
      synchronize: true,
    });
    const second = new DataSource({
      type: 'postgres',
      url,
      entities: ALL_SCHEMAS,
      synchronize: false,
    });
    try {
      await first.initialize();
      await second.initialize();
      await first
        .getRepository(CivicItemSchema)
        .save(item({ hash: 'concurrent-projection' }));
      await Promise.all([
        projectItems(first, 'adel-ga', registry),
        projectItems(second, 'adel-ga', registry),
      ]);
      expect(await first.getRepository(CanonicalStorySchema).count()).toBe(1);
      expect(await first.getRepository(CanonicalStoryItemSchema).count()).toBe(
        1
      );
      expect(await first.getRepository(EditionItemSchema).count()).toBe(1);
    } finally {
      if (first.isInitialized) await first.destroy();
      if (second.isInitialized) await second.destroy();
    }
  });

  it('stages story publication before database updates and preserves a prior artifact on forced failure', async () => {
    await withTestDataSource(async (ds) => {
      const body = `A substantive bridge project update for Adel residents. ${'Public works details and a documented timeline. '.repeat(
        8
      )}`;
      const raw = await ds.getRepository(CivicItemSchema).save(
        item({
          sourceId: 'adel-documents',
          localitySlug: 'adel-ga',
          scopeSlug: 'adel-ga',
          scopeKind: 'town',
          kind: 'meeting',
          title: 'Adel bridge project',
          body,
          hash: 'story-publication',
        })
      );
      await ds.getRepository(AgendaItemSchema).save([
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-01',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel bridge project update',
          body,
          topicKey: 'topic:bridge-project',
          procedural: false,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-15',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel bridge project update',
          body,
          topicKey: 'topic:bridge-project',
          procedural: false,
          createdAt: '2026-09-15T10:00:00.000Z',
        },
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'Adel bridge project',
          narrative: 'A durable narrative.',
          status: 'open',
          model: 'test',
        }),
      };
      const directory = mkdtempSync(join(tmpdir(), 'story-publication-'));
      const goodRoot = join(directory, 'good');
      const locality = { ...registry.get('adel-ga'), ruleVersion: V1 };
      try {
        await developStories(ds, locality, summarizer, 5, goodRoot);
        const storyFile = join(
          goodRoot,
          'adel-ga',
          readdirSync(join(goodRoot, 'adel-ga'))[0]!
        );
        const prior = readFileSync(storyFile, 'utf8');
        const blockedRoot = join(directory, 'blocked');
        writeFileSync(blockedRoot, 'not a directory');
        await expect(
          (() => developStories(ds, locality, summarizer, 5, blockedRoot))()
        ).rejects.toThrow(/not a directory|EEXIST|ENOTDIR/);
        expect(readFileSync(storyFile, 'utf8')).toBe(prior);
        expect(await ds.getRepository(EditionStorySchema).count()).toBe(1);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });

  it('compensates canonical and edition state when final story rename fails', async () => {
    await withTestDataSource(async (ds) => {
      const body = `A substantive bridge project update for Adel residents. ${'Public works details and a documented timeline. '.repeat(
        8
      )}`;
      const raw = await ds.getRepository(CivicItemSchema).save(
        item({
          sourceId: 'adel-documents',
          localitySlug: 'adel-ga',
          scopeSlug: 'adel-ga',
          scopeKind: 'town',
          kind: 'meeting',
          title: 'Adel rename failure story',
          body,
          hash: 'story-rename-failure',
        })
      );
      await ds.getRepository(AgendaItemSchema).save([
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-01',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel rename failure story',
          body,
          topicKey: 'topic:rename-failure',
          procedural: false,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          itemId: raw.id as number,
          localitySlug: 'adel-ga',
          meetingDate: '2026-09-15',
          section: 'Projects',
          ordinal: 1,
          heading: 'Adel rename failure story',
          body,
          topicKey: 'topic:rename-failure',
          procedural: false,
          createdAt: '2026-09-15T10:00:00.000Z',
        },
      ]);
      await projectItems(ds, 'adel-ga', registry);
      const firstSummarizer = {
        model: 'test',
        summarizeCluster: async () => ({ summary: 'summary', model: 'test' }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({ summary: 'thread', model: 'test' }),
        developStory: async () => ({
          title: 'Original title',
          narrative: 'Original narrative.',
          status: 'open',
          model: 'test',
        }),
      };
      const secondSummarizer = {
        ...firstSummarizer,
        developStory: async () => ({
          title: 'Mutated title',
          narrative: 'Mutated narrative.',
          status: 'closed',
          model: 'test',
        }),
      };
      const directory = mkdtempSync(join(tmpdir(), 'story-rename-failure-'));
      const goodRoot = join(directory, 'good');
      const locality = { ...registry.get('adel-ga'), ruleVersion: V1 };
      try {
        await developStories(ds, locality, firstSummarizer, 5, goodRoot);
        const storyFile = readdirSync(join(goodRoot, 'adel-ga'))[0]!;
        const before = (await ds.getRepository(CanonicalStorySchema).find())[0];
        if (!before) throw new Error('expected before');
        const blockedRoot = join(directory, 'blocked');
        mkdirSync(join(blockedRoot, 'adel-ga'), { recursive: true });
        mkdirSync(join(blockedRoot, 'adel-ga', storyFile));
        await expect(
          (() =>
            developStories(ds, locality, secondSummarizer, 5, blockedRoot))()
        ).rejects.toThrow(/EISDIR|EEXIST|directory/);
        const after = await ds
          .getRepository(CanonicalStorySchema)
          .findOneBy({ id: before.id });
        expect({ title: after?.title, status: after?.status }).toStrictEqual({
          title: before.title,
          status: before.status,
        });
        expect(await ds.getRepository(EditionStorySchema).count()).toBe(1);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });
});
