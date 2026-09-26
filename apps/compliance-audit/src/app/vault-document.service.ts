import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  VaultDocumentEntity,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import {
  VAULT_DOCUMENT_KINDS,
  VaultDocumentExcerpt,
  VaultDocumentKind,
  VaultDocumentSearchResult,
} from '@optimistic-tanuki/models';

const MAX_DOCUMENT_IDS = 50;
const DEFAULT_MAX_EXCERPTS = 6;
const DEFAULT_MAX_EXCERPT_CHARS = 1200;
const MAX_BLOCK_LINES = 12;

const PAGE_MARKER = /^(?:---\s*(\d{1,4})\s*---|Page\s+(\d{1,4})|(\d{1,4}))$/i;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'was',
  'were',
  'that',
  'this',
  'with',
  'from',
  'into',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'whose',
  'how',
  'why',
  'did',
  'does',
  'any',
  'all',
  'can',
  'could',
  'should',
  'would',
  'there',
  'their',
  'they',
  'them',
  'then',
  'than',
  'about',
  'have',
  'has',
  'had',
  'been',
  'being',
  'you',
  'your',
  'our',
  'out',
  'not',
]);

type Block = {
  offset: number;
  text: string;
  score: number;
};

export type VaultDocumentIngestInput = {
  tenantId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  documentHash: string;
  contentText: string;
};

/**
 * Classifies a document by reading it. A file name is a claim by whoever
 * uploaded it, so it is used only to break a tie the text cannot, and a text
 * that is recognisably a transcript is a transcript whatever it is called.
 */
export const classifyVaultDocument = (
  fileName: string,
  contentText: string
): VaultDocumentKind => {
  const text = contentText ?? '';
  const head = text.slice(0, 4000);

  if (
    /TRANSCRIPT OF PROCEEDINGS|BEFORE THE HONORABLE|THE WITNESS:\s*$|Case\s+No\./i.test(
      head
    ) ||
    /^(MR|MRS|MS|DR)\.\s+[A-Z]+:$/m.test(head)
  ) {
    return 'transcript';
  }

  if (
    /(Schedule\s+[A-Z]\s*\(?\s*Form\s+1040|Form\s+1040\s*\(?\s*(19|20)\d{2}|U\.?S\.?\s+Individual\s+Income\s+Tax\s+Return)/i.test(
      head
    ) ||
    /^\s*Part\s+[IVXLC]+\s*[-—:]?\s+\w+/im.test(head)
  ) {
    return 'tax_schedule';
  }

  const extension = /\.([a-z0-9]+)$/i.exec(fileName ?? '')?.[1]?.toLowerCase();
  if (extension === 'srt' || extension === 'vtt') {
    return 'transcript';
  }
  if (extension === 'csv' || extension === 'tsv') {
    return 'tax_schedule';
  }

  return 'other';
};

const terms = (value: string): string[] =>
  (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((term) => term.replace(/^'+|'+$/g, ''))
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

/**
 * The page in force at a character offset, read off the transcript's own page
 * markers. Offsets on the marker itself count as the page the marker
 * introduces, which is what a reader following the printed page numbers would
 * expect.
 */
const pageTransitions = (
  text: string
): Array<{ offset: number; page: number }> => {
  const transitions: Array<{ offset: number; page: number }> = [];
  let offset = 0;

  for (const line of text.split(/\r?\n/)) {
    const marker = PAGE_MARKER.exec(line.trim());
    if (marker) {
      const page = Number(marker[1] ?? marker[2] ?? marker[3]);
      if (Number.isFinite(page) && page > 0) {
        transitions.push({ offset, page });
      }
    }
    offset += line.length + 1;
  }

  return transitions;
};

const pageAt = (
  transitions: Array<{ offset: number; page: number }>,
  offset: number
): number | null => {
  let page: number | null = null;
  for (const transition of transitions) {
    if (transition.offset <= offset) {
      page = transition.page;
    } else {
      break;
    }
  }
  return page;
};

const clampExcerpt = (
  text: string,
  start: number,
  maxChars: number
): { length: number; text: string } => {
  if (text.length <= maxChars) {
    return { length: text.length, text };
  }
  const window = text.slice(0, maxChars);
  const lastBreak = Math.max(
    window.lastIndexOf('\n'),
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! ')
  );
  const cut = lastBreak > maxChars * 0.4 ? lastBreak + 1 : maxChars;
  const slice = text.slice(0, cut).trimEnd();
  return { length: slice.length, text: slice };
};

/**
 * Picks the passages in a document that bear on a question.
 *
 * This is term overlap, not a model, and deliberately so: an excerpt is a
 * verbatim slice of the stored text at a recorded offset, so a reviewer can put
 * the citation back on the page and see the same words. Every excerpt returned
 * is real text; the scorer only decides which real text to return.
 *
 * When nothing in the document matches the question, the opening block is
 * returned instead of an empty result. It is still real text at a real offset,
 * and a caller that named a document gets that document rather than nothing —
 * but it is ordered first because it is the lead, not because it was relevant,
 * and the prompt built from it says the passages are what the model was given.
 */
export const selectExcerpts = (
  text: string,
  query: string,
  maxExcerpts: number,
  maxExcerptChars: number
): Array<{
  offset: number;
  length: number;
  text: string;
  page: number | null;
  score: number;
}> => {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const queryTerms = [...new Set(terms(query))];
  const transitions = pageTransitions(text);
  const blocks: Block[] = [];

  let cursor = 0;
  for (const rawParagraph of text.split(/\r?\n[ \t]*\r?\n/)) {
    const start = text.indexOf(rawParagraph, cursor);
    const paragraphStart = start === -1 ? cursor : start;
    cursor = paragraphStart + rawParagraph.length;

    const lines = rawParagraph.split(/\r?\n/);
    let lineOffset = paragraphStart;

    for (let index = 0; index < lines.length; index += MAX_BLOCK_LINES) {
      const slice = lines.slice(index, index + MAX_BLOCK_LINES);
      const span = slice.join('\n');

      // Page markers and blank lines at the head of a block are furniture, not
      // content, so the excerpt starts at the first line that is neither. The
      // offset moves with it, which is what keeps the recorded offset pointing
      // at the first character of the recorded text.
      let first = 0;
      while (
        first < slice.length &&
        (!slice[first].trim() || PAGE_MARKER.test(slice[first].trim()))
      ) {
        first += 1;
      }

      if (first < slice.length) {
        const offset =
          lineOffset +
          slice.slice(0, first).reduce((sum, line) => sum + line.length + 1, 0);
        const body = slice.slice(first).join('\n');
        const haystack = new Set(terms(body));
        const score = queryTerms.reduce(
          (total, term) => (haystack.has(term) ? total + 1 : total),
          0
        );
        blocks.push({ offset, text: body, score });
      }

      lineOffset += span.length + 1;
    }
  }

  if (blocks.length === 0) {
    return [];
  }

  const anythingMatched = blocks.some((block) => block.score > 0);
  const ranked = [...blocks].sort((left, right) => {
    if (anythingMatched && left.score !== right.score) {
      return right.score - left.score;
    }
    return left.offset - right.offset;
  });

  return ranked.slice(0, maxExcerpts).map((block) => {
    const clamped = clampExcerpt(block.text, block.offset, maxExcerptChars);
    return {
      offset: block.offset,
      length: clamped.length,
      text: clamped.text,
      page: pageAt(transitions, block.offset),
      score: block.score,
    };
  });
};

/**
 * Tenant-scoped storage and retrieval for vault documents.
 *
 * Every read runs inside the tenant RLS transaction and carries the tenant in
 * the query predicate as well, so the guard is the database's and not only this
 * method's. A document id that is unknown and one that belongs to somebody else
 * come back in the same list, with the same empty result: distinguishing them
 * would turn the tool into a way to discover what other tenants hold.
 */
@Injectable()
export class VaultDocumentService {
  private readonly logger = new Logger(VaultDocumentService.name);

  constructor(
    @Inject('COMPLIANCE_AUDIT_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  async ingest(
    input: VaultDocumentIngestInput
  ): Promise<{ documentId: string; kind: VaultDocumentKind }> {
    const tenantId = this.requireTenant(input?.tenantId);
    const documentId = this.requireDocumentId(input?.documentId);
    const contentText =
      typeof input?.contentText === 'string' ? input.contentText : '';
    const fileName = (input?.fileName ?? '').toString().slice(0, 255);
    const kind = classifyVaultDocument(fileName, contentText);

    await this.transact(tenantId, async (manager) => {
      const repository = manager.getRepository(VaultDocumentEntity);
      return repository.upsert(
        {
          tenantId,
          documentId,
          fileName,
          mimeType: (input?.mimeType ?? '').toString().slice(0, 64),
          kind,
          documentHash: (input?.documentHash ?? '').toString().slice(0, 64),
          contentText,
        },
        { conflictPaths: ['tenantId', 'documentId'] }
      );
    });

    this.logger.log(
      `Stored vault document ${documentId} for tenant ${tenantId} as ${kind} with ${contentText.length} characters of text.`
    );

    return { documentId, kind };
  }

  async retrieve(
    tenantId: string,
    documentIds: string[],
    query: string,
    options: { maxExcerpts?: number; maxExcerptChars?: number } = {}
  ): Promise<VaultDocumentSearchResult> {
    const safeTenant = this.requireTenant(tenantId);
    const requested = this.normalizeIds(documentIds);
    const result: VaultDocumentSearchResult = {
      tenantId: safeTenant,
      requestedDocumentIds: requested,
      retrievedDocumentIds: [],
      unavailableDocumentIds: [],
      excerpts: [],
    };

    if (requested.length === 0) {
      return result;
    }

    const documents = await this.transact(safeTenant, async (manager) => {
      const repository = manager.getRepository(VaultDocumentEntity);
      return repository.find({
        where: { tenantId: safeTenant, documentId: In(requested) },
      });
    });

    const maxExcerpts = Math.max(
      1,
      Math.min(options.maxExcerpts ?? DEFAULT_MAX_EXCERPTS, 24)
    );
    const maxExcerptChars = Math.max(
      120,
      Math.min(options.maxExcerptChars ?? DEFAULT_MAX_EXCERPT_CHARS, 8000)
    );

    for (const document of documents) {
      const picked = selectExcerpts(
        document.contentText,
        query,
        maxExcerpts,
        maxExcerptChars
      );
      if (picked.length === 0) {
        continue;
      }
      result.retrievedDocumentIds.push(document.documentId);
      for (const excerpt of picked) {
        result.excerpts.push({
          documentId: document.documentId,
          fileName: document.fileName,
          kind: VAULT_DOCUMENT_KINDS.includes(
            document.kind as VaultDocumentKind
          )
            ? (document.kind as VaultDocumentKind)
            : 'other',
          page: excerpt.page,
          offset: excerpt.offset,
          length: excerpt.length,
          text: excerpt.text,
        } satisfies VaultDocumentExcerpt);
      }
    }

    const retrieved = new Set(result.retrievedDocumentIds);
    result.unavailableDocumentIds = requested.filter(
      (id) => !retrieved.has(id)
    );

    this.logger.log(
      `Retrieved ${result.excerpts.length} excerpts from ${result.retrievedDocumentIds.length} of ${requested.length} requested documents for tenant ${safeTenant}.`
    );

    return result;
  }

  /**
   * The whole stored text of one document, for a parser that needs the document
   * rather than a passage through it.
   *
   * Returns null — not an empty string, and not another tenant's document — when
   * the document is not in the caller's tenant or is not there at all, so the
   * two cases stay indistinguishable to whoever asked.
   */
  async readText(tenantId: string, documentId: string): Promise<string | null> {
    const safeTenant = this.requireTenant(tenantId);
    const safeDocument = this.requireDocumentId(documentId);

    const document = await this.transact(safeTenant, async (manager) => {
      const repository = manager.getRepository(VaultDocumentEntity);
      return repository.findOne({
        where: { tenantId: safeTenant, documentId: safeDocument },
      });
    });

    return document ? document.contentText ?? '' : null;
  }

  private normalizeIds(documentIds: unknown): string[] {
    if (!Array.isArray(documentIds)) {
      return [];
    }
    const seen = new Set<string>();
    for (const value of documentIds) {
      if (typeof value !== 'string') {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed) {
        seen.add(trimmed);
      }
      if (seen.size >= MAX_DOCUMENT_IDS) {
        break;
      }
    }
    return [...seen];
  }

  private requireTenant(tenantId: unknown): string {
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new BadRequestException('Tenant context is required');
    }
    return tenantId.trim();
  }

  private requireDocumentId(documentId: unknown): string {
    if (typeof documentId !== 'string' || !documentId.trim()) {
      throw new BadRequestException('A document id is required');
    }
    return documentId.trim();
  }

  private transact<T>(
    tenantId: string,
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return withTenantRlsTransaction(this.dataSource, tenantId, (manager) =>
      operation(manager as unknown as EntityManager)
    );
  }
}
