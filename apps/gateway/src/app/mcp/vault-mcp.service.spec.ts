import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  VAULT_PARSE_TAX_SCHEDULE,
  VAULT_PARSE_TRANSCRIPT,
  VAULT_SEARCH_DOCUMENTS,
} from '@optimistic-tanuki/constants';
import { VaultMcpService } from './vault-mcp.service';
import { VaultModelService } from './air-gap/vault-model.service';
import { VaultTenantResolver } from '../../security/vault-tenant-resolver.service';

const SESSION = { user: { userId: 'user-1', profileId: 'profile-1' } };

const WIREPRO_EXCERPTS = {
  tenantId: 'wirepro-cpa',
  requestedDocumentIds: ['doc-1', 'doc-memo'],
  retrievedDocumentIds: ['doc-1'],
  unavailableDocumentIds: ['doc-memo'],
  excerpts: [
    {
      documentId: 'doc-1',
      fileName: 'deposition.txt',
      kind: 'transcript',
      page: 2,
      offset: 210,
      length: 64,
      text: 'A.  It went into the shredder.',
    },
  ],
};

describe('VaultMcpService', () => {
  let complianceAudit: { send: jest.Mock };
  let tenantResolver: { resolve: jest.Mock };
  let model: { generate: jest.Mock; describe: jest.Mock };
  let service: VaultMcpService;

  beforeEach(() => {
    complianceAudit = { send: jest.fn().mockReturnValue(of(WIREPRO_EXCERPTS)) };
    tenantResolver = {
      resolve: jest.fn().mockResolvedValue('wirepro-cpa'),
    };
    model = {
      generate: jest.fn().mockResolvedValue({
        model: 'qwen2.5-coder:14b',
        text: 'Local answer.',
      }),
      describe: jest.fn().mockReturnValue({
        model: 'qwen2.5-coder:14b',
        endpointConfigured: true,
      }),
    };
    service = new VaultMcpService(
      complianceAudit as unknown as ClientProxy,
      tenantResolver as unknown as VaultTenantResolver,
      model as unknown as VaultModelService
    );
  });

  describe('who the tools act as', () => {
    it('refuses a call with no authenticated session', async () => {
      await expect(
        service.searchDocuments({ query: 'q', documentIds: ['doc-1'] }, {}, {})
      ).rejects.toThrow(/unauthenticated/i);
      expect(complianceAudit.send).not.toHaveBeenCalled();
    });

    it('derives the tenant from the session, not from anything in the arguments', async () => {
      await service.searchDocuments(
        {
          query: 'q',
          documentIds: ['doc-1'],
          tenantId: 'northgate-law',
        } as never,
        {},
        SESSION
      );

      expect(complianceAudit.send).toHaveBeenCalledWith(
        VAULT_SEARCH_DOCUMENTS,
        {
          tenantId: 'wirepro-cpa',
          documentIds: ['doc-1'],
          query: 'q',
        }
      );
    });

    it('refuses when the session resolves to no vault tenant', async () => {
      tenantResolver.resolve.mockRejectedValue(new Error('not authorized'));
      await expect(
        service.searchDocuments(
          { query: 'q', documentIds: ['doc-1'] },
          {},
          SESSION
        )
      ).rejects.toThrow();
      expect(complianceAudit.send).not.toHaveBeenCalled();
    });
  });

  describe('vault_search_documents', () => {
    it('returns the retrieved excerpts and what it could not retrieve', async () => {
      const result = await service.searchDocuments(
        {
          query: 'Who shredded the manifest?',
          documentIds: ['doc-1', 'doc-memo'],
        },
        {},
        SESSION
      );

      expect(result).toEqual(WIREPRO_EXCERPTS);
    });

    it('refuses an empty document list rather than searching the whole vault', async () => {
      await expect(
        service.searchDocuments({ query: 'q', documentIds: [] }, {}, SESSION)
      ).rejects.toThrow(/document/i);
      expect(complianceAudit.send).not.toHaveBeenCalled();
    });

    it('passes a caller-chosen excerpt budget through', async () => {
      await service.searchDocuments(
        { query: 'q', documentIds: ['doc-1'], maxExcerpts: 2 },
        {},
        SESSION
      );

      expect(complianceAudit.send).toHaveBeenCalledWith(
        VAULT_SEARCH_DOCUMENTS,
        {
          tenantId: 'wirepro-cpa',
          documentIds: ['doc-1'],
          query: 'q',
          maxExcerpts: 2,
        }
      );
    });

    it('passes an unreadable document back as unreadable and adds nothing to it', async () => {
      complianceAudit.send.mockReturnValue(
        of({
          tenantId: 'wirepro-cpa',
          requestedDocumentIds: ['doc-memo'],
          retrievedDocumentIds: [],
          unavailableDocumentIds: ['doc-memo'],
          excerpts: [],
        })
      );

      const result = await service.searchDocuments(
        { query: 'codename', documentIds: ['doc-memo'] },
        {},
        SESSION
      );

      expect(result.excerpts).toEqual([]);
      expect(result.retrievedDocumentIds).toEqual([]);
      expect(result.unavailableDocumentIds).toEqual(['doc-memo']);
    });

    it('never rewrites a document id the caller supplied into one it could read', async () => {
      await service.searchDocuments(
        { query: 'q', documentIds: ['doc-memo', 'doc-1'] },
        {},
        SESSION
      );

      expect(complianceAudit.send).toHaveBeenCalledWith(
        VAULT_SEARCH_DOCUMENTS,
        {
          tenantId: 'wirepro-cpa',
          documentIds: ['doc-memo', 'doc-1'],
          query: 'q',
        }
      );
    });
  });

  describe('vault_parse_transcript', () => {
    it('returns the structured read of the transcript', async () => {
      complianceAudit.send.mockReturnValue(
        of({
          documentId: 'doc-1',
          caseCaption: 'THORNE v. MERIDIAN LOGISTICS, INC.',
          caseNumber: '3:24-cv-01842-JLT',
          date: '2025-03-14',
          volume: 'I',
          reporter: 'R. Alvarez',
          certificationNumber: '8412',
          appearances: [],
          turns: [
            {
              page: 2,
              line: null,
              speaker: 'THE WITNESS',
              role: 'answer',
              text: 'It went into the shredder.',
            },
          ],
          exhibits: [],
          pageCount: 2,
          turnCount: 1,
          exhibitCount: 0,
        })
      );

      const result = await service.parseTranscript(
        { documentId: 'doc-1' },
        {},
        SESSION
      );

      expect(complianceAudit.send).toHaveBeenCalledWith(
        VAULT_PARSE_TRANSCRIPT,
        {
          tenantId: 'wirepro-cpa',
          documentId: 'doc-1',
        }
      );
      expect(result.turns[0]).toEqual({
        page: 2,
        line: null,
        speaker: 'THE WITNESS',
        role: 'answer',
        text: 'It went into the shredder.',
      });
      expect(result.caseNumber).toBe('3:24-cv-01842-JLT');
    });

    it('fails rather than returning an empty parse when the document is not available', async () => {
      complianceAudit.send.mockReturnValue(
        throwError(
          () => new Error('That document is not available to this tenant.')
        )
      );

      await expect(
        service.parseTranscript({ documentId: 'doc-memo' }, {}, SESSION)
      ).rejects.toThrow(/not available/i);
    });

    it('refuses a call with no document id', async () => {
      await expect(
        service.parseTranscript({ documentId: '  ' }, {}, SESSION)
      ).rejects.toThrow(/document/i);
    });
  });

  describe('vault_parse_tax_schedule', () => {
    it('returns the priced lines and the reconciliation the parser reported', async () => {
      complianceAudit.send.mockReturnValue(
        of({
          documentId: 'doc-2',
          form: 'Schedule C',
          taxYear: 2024,
          filerName: 'Delacroix Fabrication LLC',
          lineItems: [
            {
              partNumber: 1,
              partLabel: 'Part I - Income',
              lineRef: '3',
              line: 3,
              label: 'Gross profit',
              amount: 1283300,
            },
          ],
          unparsedLines: [],
          reportedTotals: {
            grossIncome: 1283300,
            totalExpenses: 47310.55,
            netProfit: 1240000,
          },
          reconciliation: {
            consistent: false,
            reportedNetProfit: 1240000,
            computedNetProfit: 1235989.45,
            difference: 4010.55,
          },
        })
      );

      const result = await service.parseTaxSchedule(
        { documentId: 'doc-2' },
        {},
        SESSION
      );

      expect(complianceAudit.send).toHaveBeenCalledWith(
        VAULT_PARSE_TAX_SCHEDULE,
        {
          tenantId: 'wirepro-cpa',
          documentId: 'doc-2',
        }
      );
      expect(result.lineItems[0].amount).toBe(1283300);
      expect(result.reconciliation.consistent).toBe(false);
      expect(result.reconciliation.difference).toBe(4010.55);
    });

    it('refuses a call with no document id', async () => {
      await expect(
        service.parseTaxSchedule({} as never, {}, SESSION)
      ).rejects.toThrow(/document/i);
    });
  });

  describe('vault_generate', () => {
    it('runs the prompt on the local model and returns what it said', async () => {
      const result = await service.generate(
        { prompt: 'Question.', system: 'You are air-gapped.' },
        {},
        SESSION
      );

      expect(model.generate).toHaveBeenCalledWith({
        prompt: 'Question.',
        system: 'You are air-gapped.',
      });
      expect(result).toEqual({
        model: 'qwen2.5-coder:14b',
        text: 'Local answer.',
      });
    });

    it('requires an authenticated session even though it reads no documents', async () => {
      await expect(
        service.generate({ prompt: 'Question.' }, {}, {})
      ).rejects.toThrow(/unauthenticated/i);
      expect(model.generate).not.toHaveBeenCalled();
    });

    it('refuses an empty prompt rather than sending a blank request', async () => {
      await expect(
        service.generate({ prompt: '   ' }, {}, SESSION)
      ).rejects.toThrow(/prompt/i);
      expect(model.generate).not.toHaveBeenCalled();
    });

    it('lets a model failure through instead of substituting an answer', async () => {
      model.generate.mockRejectedValue(
        new Error('The local model could not be reached: ECONNREFUSED')
      );

      await expect(
        service.generate({ prompt: 'Question.' }, {}, SESSION)
      ).rejects.toThrow(/could not be reached/);
    });

    it('never lets a caller choose the model', async () => {
      await service.generate(
        { prompt: 'Question.', model: 'llama3.1:70b' } as never,
        {},
        SESSION
      );

      expect(model.generate).toHaveBeenCalledWith({ prompt: 'Question.' });
    });

    it('passes a requested output format through to the model', async () => {
      await service.generate(
        { prompt: 'Question.', format: 'json' },
        {},
        SESSION
      );

      expect(model.generate).toHaveBeenCalledWith({
        prompt: 'Question.',
        format: 'json',
      });
    });
  });
});
