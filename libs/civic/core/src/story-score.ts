import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import type { DataSource } from 'typeorm';

/**
 * Hand-labeled expected stories for a corpus. Each evidence entry selects
 * linked evidence by source, a case-insensitive fragment of its title, and
 * optionally its date.
 */
export interface StoryLabels {
  version: 1;
  stories: {
    id: string;
    title: string;
    evidence: { source: string; match: string; date?: string }[];
  }[];
}

export interface ScoredEvidence {
  key: string;
  sourceId: string;
  title: string;
  date: string | null;
  storyId: number;
  storyTitle: string;
}

export interface StoryScore {
  precision: number;
  recall: number;
  truePairs: number;
  falsePairs: number;
  missedPairs: number;
  evidence: number;
  labeledEvidence: number;
  /** Label evidence entries that selected nothing. */
  unresolved: { story: string; source: string; match: string; date?: string }[];
  /** Labeled stories whose evidence landed in more than one engine story. */
  splits: {
    story: string;
    engineStories: { id: number; title: string; evidence: string[] }[];
  }[];
  /** Engine stories that joined evidence from different labeled or unlabeled stories. */
  merges: {
    id: number;
    title: string;
    groups: { label: string; evidence: string[] }[];
  }[];
}

export function parseStoryLabels(text: string): StoryLabels {
  const value = YAML.parse(text) as StoryLabels;
  if (value?.version !== 1 || !Array.isArray(value.stories))
    throw new Error('story labels must have version: 1 and a stories list');
  const ids = new Set<string>();
  for (const story of value.stories) {
    if (!story.id || ids.has(story.id))
      throw new Error(`story label id is missing or duplicated: ${story.id}`);
    ids.add(story.id);
    if (!Array.isArray(story.evidence) || story.evidence.length < 2)
      throw new Error(
        `story label ${story.id} needs at least two evidence entries`
      );
  }
  return value;
}

/** Every linked piece of evidence with its engine story, for scoring and labeling. */
export async function loadScoredEvidence(
  ds: DataSource
): Promise<ScoredEvidence[]> {
  const rows = (await ds.query(`
    SELECT l.civicItemId, l.agendaItemId, l.evidenceDate, s.id AS storyId, s.title AS storyTitle, c.sourceId, c.title AS itemTitle, a.heading
    FROM canonical_story_items l
    JOIN canonical_stories s ON s.id = l.canonicalStoryId
    JOIN civic_items c ON c.id = l.civicItemId
    LEFT JOIN agenda_items a ON a.id = l.agendaItemId
    ORDER BY l.evidenceDate, l.id`)) as {
    civicItemId: number;
    agendaItemId: number | null;
    evidenceDate: string | null;
    storyId: number;
    storyTitle: string;
    sourceId: string;
    itemTitle: string;
    heading: string | null;
  }[];
  return rows.map((row) => ({
    key: `${row.civicItemId}:${row.agendaItemId ?? 'item'}`,
    sourceId: row.sourceId,
    title: row.heading ?? row.itemTitle,
    date: row.evidenceDate,
    storyId: row.storyId,
    storyTitle: row.storyTitle,
  }));
}

function describe(evidence: ScoredEvidence): string {
  return `${evidence.date ?? 'undated'} ${
    evidence.sourceId
  }: ${evidence.title.slice(0, 90)}`;
}

/** Pairwise precision and recall of engine stories against labeled stories. */
export function scoreStories(
  evidence: readonly ScoredEvidence[],
  labels: StoryLabels
): StoryScore {
  const labelOf = new Map<string, string>();
  const unresolved: StoryScore['unresolved'] = [];
  for (const story of labels.stories) {
    for (const entry of story.evidence) {
      const selected = evidence.filter(
        (candidate) =>
          candidate.sourceId === entry.source &&
          candidate.title.toLowerCase().includes(entry.match.toLowerCase()) &&
          (!entry.date || candidate.date === entry.date)
      );
      if (!selected.length) unresolved.push({ story: story.id, ...entry });
      for (const candidate of selected) labelOf.set(candidate.key, story.id);
    }
  }
  const label = (candidate: ScoredEvidence) =>
    labelOf.get(candidate.key) ?? `unlabeled:${candidate.key}`;
  let truePairs = 0;
  let falsePairs = 0;
  let missedPairs = 0;
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const sameStory = evidence[i]!.storyId === evidence[j]!.storyId;
      const sameLabel = label(evidence[i]!) === label(evidence[j]!);
      if (sameStory && sameLabel) truePairs += 1;
      else if (sameStory) falsePairs += 1;
      else if (sameLabel) missedPairs += 1;
    }
  }
  const byStory = new Map<number, ScoredEvidence[]>();
  for (const candidate of evidence)
    byStory.set(candidate.storyId, [
      ...(byStory.get(candidate.storyId) ?? []),
      candidate,
    ]);
  const splits: StoryScore['splits'] = [];
  for (const story of labels.stories) {
    const members = evidence.filter(
      (candidate) => labelOf.get(candidate.key) === story.id
    );
    const engineIds = [
      ...new Set(members.map((candidate) => candidate.storyId)),
    ];
    if (engineIds.length > 1) {
      splits.push({
        story: story.id,
        engineStories: engineIds.map((id) => ({
          id,
          title: byStory.get(id)![0]!.storyTitle,
          evidence: members
            .filter((candidate) => candidate.storyId === id)
            .map(describe),
        })),
      });
    }
  }
  const merges: StoryScore['merges'] = [];
  for (const [id, members] of byStory) {
    const groups = new Map<string, ScoredEvidence[]>();
    for (const candidate of members)
      groups.set(label(candidate), [
        ...(groups.get(label(candidate)) ?? []),
        candidate,
      ]);
    if (groups.size > 1)
      merges.push({
        id,
        title: members[0]!.storyTitle,
        groups: [...groups].map(([name, grouped]) => ({
          label: name,
          evidence: grouped.map(describe),
        })),
      });
  }
  const ratio = (numerator: number, denominator: number) =>
    denominator ? Math.round((numerator / denominator) * 1000) / 1000 : 1;
  return {
    precision: ratio(truePairs, truePairs + falsePairs),
    recall: ratio(truePairs, truePairs + missedPairs),
    truePairs,
    falsePairs,
    missedPairs,
    evidence: evidence.length,
    labeledEvidence: labelOf.size,
    unresolved,
    splits,
    merges,
  };
}

export function readStoryLabels(path: string): StoryLabels {
  return parseStoryLabels(readFileSync(path, 'utf8'));
}
