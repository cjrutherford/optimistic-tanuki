import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopilotQueryDto,
  CopilotResponseDto,
  CopilotSourceExcerptDto,
  ParsedTaxSchedule,
  ParsedTranscript,
  TaxScheduleReportedTotals,
  VaultDocumentExcerpt,
  VaultDocumentSearchResult,
} from '@optimistic-tanuki/models';
import { McpSession, ToolsService } from './tools.service';

const TOOL_SEARCH = 'vault_search_documents';
const TOOL_PARSE_TRANSCRIPT = 'vault_parse_transcript';
const TOOL_PARSE_TAX_SCHEDULE = 'vault_parse_tax_schedule';
const TOOL_GENERATE = 'vault_generate';

const SYSTEM_INSTRUCTIONS = [
  'You are an air-gapped legal and CPA assistant working inside a confidential practice vault.',
  'You have no knowledge of anything outside the numbered passages you are given.',
  'Answer only from those passages. If they do not contain the answer, say so plainly in the answer field; do not fill the gap from general knowledge.',
  'Cite the passage numbers you actually used. Never cite a passage you were not given.',
  'Do not state a figure, a date, or a quotation that does not appear in a passage or in a structured reading supplied to you.',
  'Reply with JSON only, in exactly this shape: {"answer": "<your answer>", "citations": ["1"]}',
].join(' ');

type LabelledExcerpt = VaultDocumentExcerpt & { label: string };

type LabelledRetrieval = Omit<VaultDocumentSearchResult, 'excerpts'> & {
  excerpts: LabelledExcerpt[];
};

type GroundedAnswer = {
  answer: string;
  citations: string[];
};

/**
 * The confidential copilot, reached entirely through MCP.
 *
 * This used to open its own connection to Ollama and hand the model a prompt
 * containing the caller's question and a list of document ids. That could not
 * answer anything: no document text was ever retrieved, so there was nothing to
 * read, and the response carried `airGapped: true` on the strength of having
 * dialled a local address. Retrieval, parsing, and the model call are now three
 * MCP tools on the gateway, and the tenant that decides what is readable comes
 * from the authenticated session this call is made under rather than from the
 * request body.
 *
 * Every path out of here that is not a grounded answer is an explicit failure.
 * There is no fallback text, because a fallback is a fabricated answer wearing
 * an error's clothes.
 */
@Injectable()
export class VaultCopilotService {
  private readonly logger = new Logger(VaultCopilotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: ToolsService
  ) {}

  async queryDocuments(
    dto: CopilotQueryDto,
    accessToken?: string
  ): Promise<CopilotResponseDto> {
    const tenantId = this.requireTenantId(dto?.tenantId);
    const question = (dto?.query ?? '').trim();
    const documentIds = this.documentIds(dto?.documentIds);

    this.logger.log(
      `Confidential query from tenant ${tenantId} over ${documentIds.length} document id(s).`
    );

    if (!question) {
      return this.failure(
        'A question is required before the vault can be read.'
      );
    }
    if (documentIds.length === 0) {
      return this.failure(
        'No documents were named, so the vault was not searched. Name at least one document id to ask about.'
      );
    }

    const token = this.requireAccessToken(accessToken);

    let session: McpSession;
    try {
      session = await this.toolsService.session(token);
    } catch (error) {
      const message = this.messageOf(error);
      this.logger.warn(
        `Could not open an MCP session for the vault: ${message}`
      );
      return this.failure(
        `The vault could not be reached because this session is not authorized against the vault: ${message}`
      );
    }

    try {
      return await this.answerAs(session, question, documentIds);
    } finally {
      await session.close().catch(() => undefined);
    }
  }

  private async answerAs(
    session: McpSession,
    question: string,
    documentIds: string[]
  ): Promise<CopilotResponseDto> {
    const retrieval = await this.readDocuments(session, question, documentIds);
    if (!('excerpts' in retrieval)) {
      return retrieval;
    }

    if (retrieval.excerpts.length === 0) {
      return this.failure(
        retrieval.unavailableDocumentIds.length > 0
          ? 'None of the requested documents are available to this tenant, or carry no readable text. ' +
              'No document content was retrieved, so no answer was produced.'
          : 'The requested documents carry no readable text. No answer was produced.'
      );
    }

    const readings = await this.readStructures(session, retrieval.excerpts);

    let generated: { model: string; text: string };
    try {
      const result = await this.callTool(session, TOOL_GENERATE, {
        prompt: this.buildPrompt(question, retrieval.excerpts, readings),
        system: SYSTEM_INSTRUCTIONS,
        format: 'json',
      });
      generated = result as { model: string; text: string };
    } catch (error) {
      const message = this.messageOf(error);
      this.logger.warn(`The local model did not answer: ${message}`);
      return this.failure(
        `Vault Copilot is unavailable because the on-premises model could not be reached or would not answer: ${message} No answer was produced.`
      );
    }

    const parsed = this.parseGroundedAnswer(generated?.text);
    if (!parsed) {
      return this.failure(
        'The on-premises model returned a reply that could not be read as a grounded answer, so nothing was returned rather than an unverified one.'
      );
    }

    // The response names the model that produced it. A reply that arrives
    // without one cannot be attributed to a local model, and attributing it
    // would be a claim about where a confidential answer came from.
    if (typeof generated.model !== 'string' || !generated.model.trim()) {
      return this.failure(
        'The local model returned an answer that could not be attributed to a named model, so it was not returned.'
      );
    }

    const byLabel = new Map(
      retrieval.excerpts.map((excerpt: LabelledExcerpt) => [
        excerpt.label,
        excerpt,
      ])
    );
    const sources: CopilotSourceExcerptDto[] = [];
    const seen = new Set<string>();
    for (const citation of parsed.citations) {
      const excerpt = byLabel.get(citation);
      if (!excerpt) {
        continue;
      }
      const key = `${excerpt.documentId}:${excerpt.offset}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      sources.push({
        documentId: excerpt.documentId,
        ...(excerpt.page === null ? {} : { page: excerpt.page }),
        excerpt: excerpt.text,
      });
    }

    if (sources.length === 0) {
      return this.failure(
        'The on-premises model produced an answer that cited none of the passages it was given, so it could not be grounded in the retrieved documents and was not returned.'
      );
    }

    return {
      answer: parsed.answer,
      model: generated.model,
      sources,
      airGapped: true,
      timestamp: new Date(),
    };
  }

  private async readDocuments(
    session: McpSession,
    question: string,
    documentIds: string[]
  ): Promise<LabelledRetrieval | CopilotResponseDto> {
    let payload: unknown;
    try {
      payload = await this.callTool(session, TOOL_SEARCH, {
        query: question,
        documentIds,
      });
    } catch (error) {
      const message = this.messageOf(error);
      this.logger.warn(`Vault retrieval failed: ${message}`);
      return this.failure(
        `The vault documents could not be read: ${message} No answer was produced.`
      );
    }

    const result = payload as VaultDocumentSearchResult;
    if (!result || !Array.isArray(result.excerpts)) {
      return this.failure(
        'Vault retrieval returned something other than excerpts, so no answer was produced.'
      );
    }

    const excerpts: LabelledExcerpt[] = result.excerpts
      .filter(
        (excerpt): excerpt is VaultDocumentExcerpt =>
          !!excerpt &&
          typeof excerpt.documentId === 'string' &&
          typeof excerpt.text === 'string' &&
          excerpt.text.trim().length > 0
      )
      .map((excerpt, index) => ({ ...excerpt, label: String(index + 1) }));

    return { ...result, excerpts } satisfies LabelledRetrieval;
  }

  /**
   * Runs the deterministic parsers over whatever was retrieved, so the model is
   * handed the reading of a transcript or a schedule rather than being left to
   * work it out from the page. A parse that fails is logged and skipped: the
   * passage itself is still real and still in the prompt, and inventing a
   * reading to fill the gap is exactly what this service must not do.
   */
  private async readStructures(
    session: McpSession,
    excerpts: LabelledExcerpt[]
  ): Promise<string[]> {
    const readings: string[] = [];
    const seen = new Set<string>();

    for (const excerpt of excerpts) {
      if (seen.has(excerpt.documentId)) {
        continue;
      }
      seen.add(excerpt.documentId);

      if (excerpt.kind === 'transcript') {
        const digest = await this.tryParse(
          session,
          TOOL_PARSE_TRANSCRIPT,
          excerpt.documentId
        );
        if (digest) {
          readings.push(`Transcript: ${digest}`);
        }
        continue;
      }

      if (excerpt.kind === 'tax_schedule') {
        const digest = await this.tryParse(
          session,
          TOOL_PARSE_TAX_SCHEDULE,
          excerpt.documentId
        );
        if (digest) {
          readings.push(`Tax schedule: ${digest}`);
        }
      }
    }

    return readings;
  }

  private async tryParse(
    session: McpSession,
    tool: string,
    documentId: string
  ): Promise<string | null> {
    try {
      const payload = (await this.callTool(session, tool, { documentId })) as
        | ParsedTranscript
        | ParsedTaxSchedule;

      return tool === TOOL_PARSE_TRANSCRIPT
        ? this.digestTranscript(payload as ParsedTranscript)
        : this.digestTaxSchedule(payload as ParsedTaxSchedule);
    } catch (error) {
      this.logger.warn(
        `${tool} could not read a retrieved document: ${this.messageOf(error)}`
      );
      return null;
    }
  }

  private digestTranscript(parsed: ParsedTranscript): string | null {
    if (!parsed) {
      return null;
    }
    const parts = [
      parsed.caseCaption ? `case ${parsed.caseCaption}` : null,
      parsed.caseNumber ? `number ${parsed.caseNumber}` : null,
      parsed.date ? `taken ${parsed.date}` : null,
      `${parsed.pageCount} pages`,
      `${parsed.turnCount} recorded turns`,
      parsed.exhibitCount > 0 ? `${parsed.exhibitCount} exhibits` : null,
    ].filter(
      (part): part is string => typeof part === 'string' && part.length > 0
    );

    const counts = [
      `questions ${
        parsed.turns.filter((turn) => turn.role === 'question').length
      }`,
      `answers ${parsed.turns.filter((turn) => turn.role === 'answer').length}`,
    ].join(', ');

    return `${parts.join(', ')}; ${counts}.`;
  }

  private digestTaxSchedule(parsed: ParsedTaxSchedule): string | null {
    if (!parsed) {
      return null;
    }
    const totals: TaxScheduleReportedTotals = parsed.reportedTotals ?? {
      grossIncome: null,
      totalExpenses: null,
      netProfit: null,
    };
    const parts = [
      parsed.form
        ? `${parsed.form}${parsed.taxYear ? ` (${parsed.taxYear})` : ''}`
        : null,
      parsed.filerName ? `for ${parsed.filerName}` : null,
      totals.grossIncome === null ? null : `gross income ${totals.grossIncome}`,
      totals.totalExpenses === null
        ? null
        : `total expenses ${totals.totalExpenses}`,
      totals.netProfit === null ? null : `net profit ${totals.netProfit}`,
    ].filter(
      (part): part is string => typeof part === 'string' && part.length > 0
    );

    if (parts.length === 0) {
      return null;
    }

    const reconciliation =
      parsed.reconciliation?.consistent === true
        ? ' The printed totals are consistent with each other.'
        : parsed.reconciliation?.consistent === false
        ? ` The printed totals do not reconcile: the schedule prints a net profit of ${parsed.reconciliation.reportedNetProfit} against ${parsed.reconciliation.computedNetProfit} implied by the printed gross income and expenses, a difference of ${parsed.reconciliation.difference}. Do not present either figure as verified.`
        : '';

    return `${parts.join(', ')}.${reconciliation}`;
  }

  private buildPrompt(
    question: string,
    excerpts: LabelledExcerpt[],
    readings: string[]
  ): string {
    const passages = excerpts
      .map(
        (excerpt) =>
          `[${excerpt.label}]${
            excerpt.page === null ? '' : ` (page ${excerpt.page})`
          }\n${excerpt.text}`
      )
      .join('\n\n');

    const structured =
      readings.length > 0
        ? `\n\nStructured readings already taken from these documents:\n${readings
            .map((reading) => `- ${reading}`)
            .join('\n')}`
        : '';

    return (
      `Question:\n${question}\n\n` +
      `Passages retrieved from the vault:\n\n${passages}${structured}`
    );
  }

  /**
   * The model's reply has to be an object with an answer and a list of passage
   * labels. Anything else — prose, an array, an object with the wrong types, a
   * truncated fragment — is refused, because a reply that cannot be read cannot
   * be checked against what was retrieved, and an unchecked reply presented as
   * a document-grounded answer is the failure this whole path exists to prevent.
   */
  private parseGroundedAnswer(text: unknown): GroundedAnswer | null {
    if (typeof text !== 'string' || !text.trim()) {
      return null;
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      return null;
    }

    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return null;
    }

    const { answer, citations } = candidate as Record<string, unknown>;
    if (typeof answer !== 'string' || !answer.trim()) {
      return null;
    }
    if (!Array.isArray(citations)) {
      return null;
    }

    return {
      answer: answer.trim(),
      citations: citations.filter(
        (citation): citation is string => typeof citation === 'string'
      ),
    };
  }

  private async callTool(
    session: McpSession,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const result = await session.callTool(name, args);
    return this.readToolText(result);
  }

  private readToolText(result: unknown): unknown {
    if (result && typeof result === 'object' && 'content' in result) {
      const content = (result as { content: unknown }).content;
      if (Array.isArray(content)) {
        const text = content
          .filter(
            (part): part is { type: string; text: string } =>
              !!part &&
              typeof part === 'object' &&
              (part as { type?: unknown }).type === 'text' &&
              typeof (part as { text?: unknown }).text === 'string'
          )
          .map((part) => part.text)
          .join('\n');
        return this.parseMaybeJson(text);
      }
    }
    if (typeof result === 'string') {
      return this.parseMaybeJson(result);
    }
    return this.parseMaybeJson(JSON.stringify(result ?? null));
  }

  private parseMaybeJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * The only shape a failure takes. `model` is 'none' and `sources` is empty
   * because passages that were retrieved are not evidence for an answer that
   * was not produced, and `airGapped` is false because nothing was analysed on
   * this network.
   */
  private failure(reason: string): CopilotResponseDto {
    return {
      answer: reason,
      model: 'none',
      sources: [],
      airGapped: false,
      timestamp: new Date(),
    };
  }

  private requireTenantId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new UnauthorizedException(
        'A tenant-scoped session is required for vault copilot queries.'
      );
    }
    return value.trim();
  }

  private requireAccessToken(accessToken: unknown): string {
    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new UnauthorizedException(
        'Vault copilot queries are made on a caller own MCP session, so the caller credential has to reach this service.'
      );
    }
    return accessToken.trim();
  }

  private documentIds(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return [
      ...new Set(
        values
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      ),
    ];
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
