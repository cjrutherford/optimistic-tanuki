import { Controller, Logger, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  VAULT_INGEST_DOCUMENT,
  VAULT_PARSE_TAX_SCHEDULE,
  VAULT_PARSE_TRANSCRIPT,
  VAULT_SEARCH_DOCUMENTS,
} from '@optimistic-tanuki/constants';
import {
  ParsedTaxSchedule,
  ParsedTranscript,
  VaultDocumentKind,
  VaultDocumentSearchResult,
} from '@optimistic-tanuki/models';
import {
  VaultDocumentIngestInput,
  VaultDocumentService,
} from './vault-document.service';
import { parseTaxSchedule } from './vault-parsers/tax-schedule.parser';
import { parseTranscript } from './vault-parsers/transcript.parser';

type DocumentPayload = { tenantId?: unknown; documentId?: unknown };
type SearchPayload = {
  tenantId?: unknown;
  documentIds?: unknown;
  query?: unknown;
  maxExcerpts?: unknown;
};

/**
 * The text side of the vault.
 *
 * Kept apart from the audit ledger controller on purpose: the ledger is the
 * immutable record of what happened, and this is the readable copy of what was
 * said. They are joined by tenant and document id, never by one calling the
 * other, so a change to how a document is read cannot quietly alter the chain
 * that sealed it.
 *
 * The tenant arrives from the caller, and the caller is the gateway's MCP tool,
 * which derives it from the authenticated session rather than from an argument.
 * Every handler still refuses a payload with no tenant, because a read that
 * happened without one would be a read across the whole vault.
 */
@Controller()
export class VaultDocumentController {
  private readonly logger = new Logger(VaultDocumentController.name);

  constructor(private readonly documents: VaultDocumentService) {}

  @MessagePattern(VAULT_INGEST_DOCUMENT)
  async ingest(
    @Payload() payload: VaultDocumentIngestInput
  ): Promise<{ documentId: string; kind: VaultDocumentKind }> {
    return this.documents.ingest(payload);
  }

  @MessagePattern(VAULT_SEARCH_DOCUMENTS)
  async search(
    @Payload() payload: SearchPayload
  ): Promise<VaultDocumentSearchResult> {
    return this.documents.retrieve(
      payload?.tenantId as string,
      Array.isArray(payload?.documentIds)
        ? (payload.documentIds as string[])
        : [],
      typeof payload?.query === 'string' ? payload.query : '',
      {
        maxExcerpts:
          typeof payload?.maxExcerpts === 'number'
            ? payload.maxExcerpts
            : undefined,
      }
    );
  }

  @MessagePattern(VAULT_PARSE_TRANSCRIPT)
  async parseTranscriptDocument(
    @Payload() payload: DocumentPayload
  ): Promise<ParsedTranscript> {
    const text = await this.requireDocumentText(payload);
    return {
      ...parseTranscript(text),
      documentId: String(payload?.documentId),
    };
  }

  @MessagePattern(VAULT_PARSE_TAX_SCHEDULE)
  async parseTaxScheduleDocument(
    @Payload() payload: DocumentPayload
  ): Promise<ParsedTaxSchedule> {
    const text = await this.requireDocumentText(payload);
    return {
      ...parseTaxSchedule(text),
      documentId: String(payload?.documentId),
    };
  }

  /**
   * Reads the stored text for one document in the caller's tenant. The text is
   * parsed here and returned as structure, so it never crosses the wire back to
   * a caller that only wanted the reading of it.
   */
  private async requireDocumentText(payload: DocumentPayload): Promise<string> {
    const text = await this.documents.readText(
      payload?.tenantId as string,
      String(payload?.documentId ?? '')
    );

    if (text === null) {
      this.logger.warn(
        `No document ${String(
          payload?.documentId
        )} is available to the requested tenant.`
      );
      throw new NotFoundException(
        'That document is not available to this tenant.'
      );
    }

    if (!text.trim()) {
      this.logger.warn(
        `Document ${String(payload?.documentId)} has no readable text on file.`
      );
      throw new NotFoundException(
        'That document has no readable text on file.'
      );
    }

    return text;
  }
}
