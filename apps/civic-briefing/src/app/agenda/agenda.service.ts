import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  agendaIdentity,
  AgendaItemSchema,
  CivicItemSchema,
  extractAgendaItems,
  isOutlineAgenda,
  isDayInContextWindow,
  itemLocalDate,
  loadThreads,
  meetingDateFromTitle,
  normalizeAgendaDrafts,
  topicKey,
  type AgendaFixup,
  type AgendaItemDraft,
  type ExtractResult,
  type LocalityConfig,
} from '@optimistic-tanuki/civic-core';

/**
 * Finds the individual pieces of business inside a meeting document.
 *
 * Rules do the extraction. A model is asked only when the rules fail
 * structurally — fewer than two rows out of a long document — and its answer
 * is accepted only where the wording actually appears in the document, so a
 * repair can reorganise text but never invent it. The attempt is budgeted per
 * run, because a town with many unparsed documents should surface as a gap
 * rather than a long model bill.
 */

export interface ExtractAgendaRequest {
  /** An edition, whose run sources select the documents, or an owner slug. */
  locality: string | Pick<LocalityConfig, 'slug' | 'sources'>;
  fixup?: AgendaFixup;
  contextRange?: { start: string; end: string };
  timezone?: string;
  runId?: number;
}

const FIXUP_BUDGET = 6;
/** An agenda row needs at least this many words to be worth showing. */
const MIN_WORDS = 2;

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(CivicItemSchema)
    private readonly items: Repository<Record<string, any>>,
    @InjectRepository(AgendaItemSchema)
    private readonly rows: Repository<Record<string, any>>
  ) {}

  async extract(request: ExtractAgendaRequest): Promise<ExtractResult> {
    const result: ExtractResult = {
      items: 0,
      threads: 0,
      fixedByLlm: 0,
      fixupFailures: 0,
    };
    const timezone = request.timezone ?? 'UTC';
    const localitySlug =
      typeof request.locality === 'string'
        ? request.locality
        : request.locality.slug;
    const sourceKeys =
      typeof request.locality === 'string'
        ? []
        : request.locality.sources.map((source) => source.sourceKey);

    const documents = (
      await this.items.find({
        where: sourceKeys.length
          ? { sourceId: In(sourceKeys), kind: 'meeting' }
          : { localitySlug, kind: 'meeting' },
      })
    ).filter((document) => {
      const day = itemLocalDate(document as never, timezone);
      return (
        !request.contextRange ||
        !day ||
        isDayInContextWindow(day, request.contextRange, document['kind'])
      );
    });

    let fixupBudget = FIXUP_BUDGET;
    for (const document of documents) {
      let drafts: AgendaItemDraft[] = extractAgendaItems(document['body']).map(
        (draft) => ({ ...draft })
      );
      if (
        drafts.length < 2 &&
        document['body'].length > 500 &&
        !isOutlineAgenda(document['body']) &&
        request.fixup &&
        fixupBudget > 0
      ) {
        fixupBudget -= 1;
        drafts = await this.repair(document, drafts, request, result);
      }
      const meetingDate =
        meetingDateFromTitle(document['title']) ??
        itemLocalDate(document as never, timezone) ??
        null;
      const eligible = drafts.filter((draft) => this.worthShowing(draft));
      result.items += await this.persist(
        document['id'] as number,
        document['localitySlug'],
        meetingDate,
        normalizeAgendaDrafts(eligible)
      );
    }

    result.threads = (
      await loadThreads(
        this.items.manager.connection,
        localitySlug,
        false,
        undefined,
        undefined,
        request.contextRange,
        timezone,
        sourceKeys
      )
    ).length;
    return result;
  }

  /**
   * A repair is accepted only when it produces at least two rows whose
   * headings appear in the document; otherwise the rule output stands.
   */
  private async repair(
    document: Record<string, any>,
    drafts: AgendaItemDraft[],
    request: ExtractAgendaRequest,
    result: ExtractResult
  ): Promise<AgendaItemDraft[]> {
    try {
      const repaired = await request.fixup!({
        body: document['body'],
        sourceKey: document['sourceId'],
        civicItemId: document['id'] as number,
        ...(request.runId !== undefined
          ? { runId: String(request.runId) }
          : {}),
      });
      const normalized = document['body'].toLowerCase().replace(/\s+/gu, ' ');
      const grounded = repaired.filter((row) =>
        normalized.includes(
          row.heading.toLowerCase().replace(/\s+/gu, ' ').slice(0, 60)
        )
      );
      if (grounded.length < 2) return drafts;
      result.fixedByLlm += 1;
      return grounded.map((row, index) => ({
        section: row.section || 'General',
        ordinal: index + 1,
        heading: row.heading.slice(0, 150),
        body: row.body.slice(0, 800),
        procedural: false,
      }));
    } catch {
      result.fixupFailures += 1;
      return drafts;
    }
  }

  /**
   * Quality floor. Agenda titles are legitimately short ("2. Recovery
   * Proclamation"), so the test is words rather than length, and a bare
   * "Meeting Agenda" heading with no text beneath it is a document title
   * that the extractor mistook for business.
   */
  private worthShowing(draft: AgendaItemDraft): boolean {
    const text =
      draft.heading === draft.section
        ? draft.body
        : draft.heading.replace(/^\d{1,2}\.\s*/u, '');
    if ((text.match(/\p{L}{2,}/gu) ?? []).length < MIN_WORDS) return false;
    return !(
      draft.body.trim().length < 120 &&
      /^(session\s+)?meeting agenda\b/iu.test(
        draft.heading.replace(/^[^a-z]+/iu, '')
      )
    );
  }

  /**
   * Rewrites a document's rows in place. Rows keep their identity (section
   * and position) so a re-extraction updates rather than duplicates, and
   * rows the document no longer contains are removed rather than left to
   * haunt later editions.
   */
  private async persist(
    itemId: number,
    localitySlug: string,
    meetingDate: string | null,
    drafts: readonly AgendaItemDraft[]
  ): Promise<number> {
    return this.rows.manager.connection.transaction(async (manager) => {
      const repository = manager.getRepository(AgendaItemSchema);
      const existing = await repository.find({
        where: { itemId },
        order: { id: 'ASC' },
      });
      const byIdentity = new Map<string, Record<string, any>>();
      const duplicates: number[] = [];
      for (const row of existing) {
        const identity = agendaIdentity(row.section, row.ordinal);
        if (byIdentity.has(identity)) {
          if (row.id !== undefined) duplicates.push(row.id);
        } else byIdentity.set(identity, row);
      }
      const expected = new Map(
        drafts.map((draft) => [
          agendaIdentity(draft.section, draft.ordinal),
          draft,
        ])
      );
      const stale = existing
        .filter(
          (row) =>
            row.id !== undefined &&
            !expected.has(agendaIdentity(row.section, row.ordinal))
        )
        .map((row) => row.id as number);
      const removable = [...new Set([...stale, ...duplicates])];
      if (removable.length) await repository.delete(removable);

      let inserted = 0;
      for (const draft of drafts) {
        const row = byIdentity.get(
          agendaIdentity(draft.section, draft.ordinal)
        );
        const values = {
          localitySlug,
          meetingDate,
          section: draft.section,
          ordinal: draft.ordinal,
          heading: draft.heading,
          body: draft.body,
          topicKey: topicKey(`${draft.heading} ${draft.body}`),
          procedural: draft.procedural,
        };
        if (row?.['id'] !== undefined)
          await repository.update(row['id'], values);
        else {
          await repository.insert({
            itemId,
            ...values,
            createdAt: new Date().toISOString(),
          });
          inserted += 1;
        }
      }
      return inserted;
    });
  }
}
