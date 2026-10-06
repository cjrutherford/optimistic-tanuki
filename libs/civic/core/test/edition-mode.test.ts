import { resolveEditionMode, type EditionMode } from '../src/edition-mode.js';
import { buildClusterEvidenceItems } from '../src/pipeline.js';
import type { CivicItemRow, AgendaItemRow } from '../src/schema.js';

test('fresh context evidence selects bootstrap rather than quiet', () => {
  const mode = resolveEditionMode({
    dailyEvidence: true,
    currentPeriodStart: '2026-09-15',
  });
  expect(mode).toBe('bootstrap' satisfies EditionMode);
});

test('fresh empty context selects initial-empty without a prior edition', () => {
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
    })
  ).toBe('initial-empty');
});

test('a first edition with only context evidence summarizes the context window', () => {
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      contextEvidence: true,
      currentPeriodStart: '2026-09-15',
    })
  ).toBe('bootstrap');
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      contextEvidence: true,
      currentPeriodStart: '2026-09-15',
      verifiedPriorEdition: true,
    })
  ).toBe('initial-empty');
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      contextEvidence: true,
      currentPeriodStart: '2026-09-15',
      priorDaily: {
        periodStart: '2026-09-14',
        periodEnd: '2026-09-15',
        artifactVerified: true,
      },
    })
  ).toBe('quiet');
});

test('quiet requires a verified immediately preceding edition', () => {
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
      priorDaily: {
        periodStart: '2026-09-14',
        periodEnd: '2026-09-15',
        artifactVerified: true,
      },
    })
  ).toBe('quiet');
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
      priorDaily: {
        periodStart: '2026-09-14',
        periodEnd: '2026-09-15',
        artifactVerified: false,
      },
    })
  ).toBe('initial-empty');
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
      priorDaily: {
        periodStart: '2026-09-13',
        periodEnd: '2026-09-14',
        artifactVerified: true,
      },
    })
  ).toBe('initial-empty');
});

test('same-period prior is not evidence for quiet mode', () => {
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
      samePeriodPrior: true,
    })
  ).toBe('initial-empty');
});

test('does not call a later run bootstrap when any verified prior edition exists', () => {
  expect(
    resolveEditionMode({
      dailyEvidence: true,
      currentPeriodStart: '2026-09-15',
      verifiedPriorEdition: true,
    })
  ).toBe('normal');
  expect(
    resolveEditionMode({
      dailyEvidence: false,
      currentPeriodStart: '2026-09-15',
      verifiedPriorEdition: true,
    })
  ).toBe('initial-empty');
});

test('projects exact agenda rows into cluster evidence instead of parent bodies', () => {
  const parent = {
    id: 7,
    sourceId: 'agenda',
    title: 'Agenda packet',
    body: 'PARENT BODY',
    kind: 'meeting',
    accessMode: 'full',
    localitySlug: 'town',
    scopeSlug: 'town',
    scopeKind: 'town',
  } as CivicItemRow;
  const row = {
    id: 42,
    itemId: 7,
    localitySlug: 'town',
    meetingDate: '2026-09-15',
    section: 'Business',
    ordinal: 1,
    heading: 'Resolution Approving housing',
    body: 'The row lists the housing proposal for consideration.',
    topicKey: 'housing',
    procedural: false,
    createdAt: '2026-09-15T00:00:00Z',
  } as AgendaItemRow;
  const [evidence] = buildClusterEvidenceItems(
    [parent],
    new Map([[7, [row]]]),
    new Map([['agenda', 'Town agenda']])
  );
  expect(evidence?.evidenceKind).toBe('agenda-row');
  expect(evidence?.agendaItemId).toBe(42);
  expect(evidence?.body).toBe(row.body);
  expect(evidence?.parentDocumentContext?.body).toBe(parent.body);
});
