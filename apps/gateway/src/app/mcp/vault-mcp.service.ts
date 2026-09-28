import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import {
  ServiceTokens,
  VAULT_PARSE_TAX_SCHEDULE,
  VAULT_PARSE_TRANSCRIPT,
  VAULT_SEARCH_DOCUMENTS,
} from '@optimistic-tanuki/constants';
import {
  ParsedTaxSchedule,
  ParsedTranscript,
  UserContext,
  VaultDocumentSearchResult,
} from '@optimistic-tanuki/models';
import { VaultTenantResolver } from '../../security/vault-tenant-resolver.service';
import { VaultModelService } from './air-gap/vault-model.service';

const searchDocumentsSchema = z.object({
  query: z.string().min(1).describe('The question to find passages for.'),
  documentIds: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'The vault document ids to read. Each is checked against the tenant on ' +
        'your own session; an id that is not yours comes back as unavailable ' +
        'and its content is never returned.'
    ),
  maxExcerpts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('How many passages to return in total. Defaults to six.'),
});

const documentIdSchema = z.object({
  documentId: z
    .string()
    .min(1)
    .describe(
      'The vault document id to read. It must belong to your tenant; one that ' +
        'does not is refused rather than searched.'
    ),
});

const generateSchema = z.object({
  prompt: z.string().min(1).describe('The prompt to run on the local model.'),
  system: z
    .string()
    .optional()
    .describe('System instructions for the local model.'),
  format: z
    .enum(['json'])
    .optional()
    .describe(
      'Ask the model for JSON rather than prose. Used when the reply has to ' +
        'be checked before it is shown, because prose cannot be.'
    ),
});

/**
 * The vault's MCP surface.
 *
 * Four tools, and the shape of them is the point. Every one derives the tenant
 * from the authenticated MCP session, which the gateway's `McpAuthGuard` has
 * already resolved from the bearer token, and none of them accepts a tenant as
 * an argument. A caller that names somebody else's tenant in its arguments gets
 * its own tenant, so the copilot's own idea of who is asking cannot widen what
 * is readable.
 *
 * The model is reached through `vault_generate` rather than through a socket the
 * caller opened. That is what makes the air gap a control instead of a claim:
 * the endpoint is checked against the local-network rule on every call, and this
 * file has no other way to reach one.
 *
 * Nothing here fills in an answer. A document that is not yours, a document with
 * no readable text, a parse that finds nothing, and a model that will not
 * respond are all reported as what they are.
 */
@Injectable()
export class VaultMcpService {
  private readonly logger = new Logger(VaultMcpService.name);

  constructor(
    @Inject(ServiceTokens.COMPLIANCE_AUDIT_SERVICE)
    private readonly complianceAudit: ClientProxy,
    private readonly tenantResolver: VaultTenantResolver,
    private readonly model: VaultModelService
  ) {}

  @McpTool({
    name: 'vault_search_documents',
    description:
      'Read passages from Practice Vault documents belonging to the authenticated tenant. Returns verbatim excerpts with the offset and page each came from, plus the ids that could not be read.',
    parameters: searchDocumentsSchema,
  })
  async searchDocuments(
    args: z.infer<typeof searchDocumentsSchema>,
    _context: unknown,
    request: unknown
  ): Promise<VaultDocumentSearchResult> {
    const tenantId = await this.tenantFor(request);
    const documentIds = this.documentIds(args?.documentIds);

    this.logger.log(
      `MCP Tool: searching ${documentIds.length} vault document(s) for tenant ${tenantId}.`
    );

    return firstValueFrom(
      this.complianceAudit.send<VaultDocumentSearchResult>(
        VAULT_SEARCH_DOCUMENTS,
        {
          tenantId,
          documentIds,
          query: args.query,
          ...(typeof args.maxExcerpts === 'number'
            ? { maxExcerpts: args.maxExcerpts }
            : {}),
        }
      )
    );
  }

  @McpTool({
    name: 'vault_parse_transcript',
    description:
      'Read a hearing or deposition transcript belonging to the authenticated tenant into structured turns: speaker, page, role, exhibits, case caption and reporter.',
    parameters: documentIdSchema,
  })
  async parseTranscript(
    args: z.infer<typeof documentIdSchema>,
    _context: unknown,
    request: unknown
  ): Promise<ParsedTranscript> {
    const tenantId = await this.tenantFor(request);
    const documentId = this.documentId(args?.documentId);

    this.logger.log(
      `MCP Tool: parsing transcript ${documentId} for tenant ${tenantId}.`
    );

    return firstValueFrom(
      this.complianceAudit.send<ParsedTranscript>(VAULT_PARSE_TRANSCRIPT, {
        tenantId,
        documentId,
      })
    );
  }

  @McpTool({
    name: 'vault_parse_tax_schedule',
    description:
      'Read a tax schedule belonging to the authenticated tenant into priced line items, the totals the schedule printed, and whether those totals are consistent with each other.',
    parameters: documentIdSchema,
  })
  async parseTaxSchedule(
    args: z.infer<typeof documentIdSchema>,
    _context: unknown,
    request: unknown
  ): Promise<ParsedTaxSchedule> {
    const tenantId = await this.tenantFor(request);
    const documentId = this.documentId(args?.documentId);

    this.logger.log(
      `MCP Tool: parsing tax schedule ${documentId} for tenant ${tenantId}.`
    );

    return firstValueFrom(
      this.complianceAudit.send<ParsedTaxSchedule>(VAULT_PARSE_TAX_SCHEDULE, {
        tenantId,
        documentId,
      })
    );
  }

  @McpTool({
    name: 'vault_generate',
    description:
      'Run a prompt on the on-premises model. This is the only route to a model from the vault, and it will only reach the configured local endpoint.',
    parameters: generateSchema,
  })
  async generate(
    args: z.infer<typeof generateSchema>,
    _context: unknown,
    request: unknown
  ): Promise<{ model: string; text: string }> {
    await this.tenantFor(request);

    const prompt = args?.prompt?.trim();
    if (!prompt) {
      throw new Error(
        'A non-empty prompt is required to reach the local model.'
      );
    }

    return this.model.generate({
      prompt,
      ...(args?.system ? { system: args.system } : {}),
      ...(args?.format ? { format: args.format } : {}),
    });
  }

  /**
   * The tenant this call acts as.
   *
   * Taken from the request the `McpAuthGuard` authenticated, and then resolved
   * through finance, which is the authority on which principal belongs to which
   * tenant. A principal finance does not recognise is refused here rather than
   * being handed an empty or caller-chosen tenant.
   */
  private async tenantFor(request: unknown): Promise<string> {
    const user = (request as { user?: UserContext } | undefined)?.user;
    if (!user?.userId || !user.profileId) {
      throw new Error('Unauthenticated MCP call');
    }

    const tenantId = await this.tenantResolver.resolve({
      userId: user.userId,
      profileId: user.profileId,
    });

    if (!tenantId) {
      throw new Error(
        'This principal is not authorized for a vault tenant, so the vault tools have nothing to act as.'
      );
    }

    return tenantId;
  }

  private documentIds(values: unknown): string[] {
    const list = (Array.isArray(values) ? values : [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (list.length === 0) {
      throw new Error(
        'At least one document id is required. The vault is not searched without one.'
      );
    }

    return [...new Set(list)];
  }

  private documentId(value: unknown): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      throw new Error('A document id is required.');
    }
    return trimmed;
  }
}
