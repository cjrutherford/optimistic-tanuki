import { ConfigService } from '@nestjs/config';
import { McpSession, ToolsService } from './tools.service';
import { VaultCopilotService } from './vault-copilot.service';

const DEPOSITION_EXCERPT = `Q.  What happened to the manifest on the third of March?
A.  It went into the shredder.`;

const SCHEDULE_EXCERPT = `31  Net profit                                1,235,989.45`;

const SEARCH_RESULT = {
  tenantId: 'wirepro-cpa',
  requestedDocumentIds: ['doc-1', 'doc-2'],
  retrievedDocumentIds: ['doc-1', 'doc-2'],
  unavailableDocumentIds: [],
  excerpts: [
    {
      documentId: 'doc-1',
      fileName: 'deposition.txt',
      kind: 'transcript',
      page: 2,
      offset: 210,
      length: DEPOSITION_EXCERPT.length,
      text: DEPOSITION_EXCERPT,
    },
    {
      documentId: 'doc-2',
      fileName: 'schedule-c.txt',
      kind: 'tax_schedule',
      page: null,
      offset: 0,
      length: SCHEDULE_EXCERPT.length,
      text: SCHEDULE_EXCERPT,
    },
  ],
};

const TRANSCRIPT_PARSE = {
  documentId: 'doc-1',
  caseCaption: 'THORNE v. MERIDIAN LOGISTICS, INC.',
  caseNumber: '3:24-cv-01842-JLT',
  date: '2025-03-14',
  volume: 'I',
  reporter: 'R. Alvarez',
  certificationNumber: '8412',
  appearances: [],
  turns: [],
  exhibits: [],
  pageCount: 214,
  turnCount: 3180,
  exhibitCount: 12,
};

const SCHEDULE_PARSE = {
  documentId: 'doc-2',
  form: 'Schedule C',
  taxYear: 2024,
  filerName: 'Delacroix Fabrication LLC',
  lineItems: [],
  unparsedLines: [],
  reportedTotals: {
    grossIncome: 1283300,
    totalExpenses: 47310.55,
    netProfit: 1235989.45,
  },
  reconciliation: {
    consistent: true,
    reportedNetProfit: 1235989.45,
    computedNetProfit: 1235989.45,
    difference: 0,
  },
};

describe('VaultCopilotService', () => {
  let service: VaultCopilotService;
  let session: McpSession;
  let callTool: jest.Mock;
  let close: jest.Mock;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  // mcp-nest serialises a tool's return value as one JSON text block, so this
  // is the shape a session actually hands back.
  const toolResult = (value: unknown) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
  });

  const modelSays = (text: string) => ({ model: 'qwen2.5-coder:14b', text });

  const groundedAnswer = JSON.stringify({
    answer:
      'The witness testified that the manifest went into the shredder on the third of March.',
    citations: ['1'],
  });

  const query = {
    query: 'What happened to the manifest?',
    tenantId: 'wirepro-cpa',
    documentIds: ['doc-1', 'doc-2'],
  };

  beforeEach(() => {
    callTool = jest.fn(async (name: string) => {
      if (name === 'vault_search_documents') {
        return toolResult(SEARCH_RESULT);
      }
      if (name === 'vault_parse_transcript') {
        return toolResult(TRANSCRIPT_PARSE);
      }
      if (name === 'vault_parse_tax_schedule') {
        return toolResult(SCHEDULE_PARSE);
      }
      if (name === 'vault_generate') {
        return toolResult(modelSays(groundedAnswer));
      }
      throw new Error(`Unexpected tool ${name}`);
    });
    close = jest.fn().mockResolvedValue(undefined);
    session = {
      listTools: jest.fn().mockResolvedValue([]),
      callTool,
      close,
    };

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new VaultCopilotService(
      { get: jest.fn() } as unknown as ConfigService,
      {
        session: jest.fn().mockResolvedValue(session),
      } as unknown as ToolsService
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('reaching the model', () => {
    it('goes through the MCP tools rather than opening its own connection', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const names = callTool.mock.calls.map(([name]) => name);
      expect(names).toContain('vault_search_documents');
      expect(names).toContain('vault_generate');
    });

    it('never makes an outbound request of its own', async () => {
      await service.queryDocuments(query, 'bearer-token');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('opens the session with the caller own credential', async () => {
      const tools = { session: jest.fn().mockResolvedValue(session) };
      const scoped = new VaultCopilotService(
        { get: jest.fn() } as unknown as ConfigService,
        tools as unknown as ToolsService
      );

      await scoped.queryDocuments(query, 'bearer-token');

      expect(tools.session).toHaveBeenCalledWith('bearer-token');
    });

    it('closes the session it opened', async () => {
      await service.queryDocuments(query, 'bearer-token');

      expect(close).toHaveBeenCalled();
    });

    it('asks for a structured answer so the reply can be checked', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const generate = callTool.mock.calls.find(
        ([name]) => name === 'vault_generate'
      );
      expect(JSON.stringify(generate?.[1])).toMatch(/json/i);
    });
  });

  describe('the retrieved material', () => {
    it('puts the retrieved passages in the prompt and nothing else', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const generate = callTool.mock.calls.find(
        ([name]) => name === 'vault_generate'
      );
      const prompt: string = generate?.[1].prompt;

      expect(prompt).toContain('It went into the shredder');
      expect(prompt).toContain('What happened to the manifest?');
    });

    it('cites the document the passage actually came from', async () => {
      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.sources).toEqual([
        {
          documentId: 'doc-1',
          page: 2,
          excerpt: DEPOSITION_EXCERPT,
        },
      ]);
    });

    it('never puts the tenant or the document identifiers in the prompt', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const generate = callTool.mock.calls.find(
        ([name]) => name === 'vault_generate'
      );
      const prompt: string = generate?.[1].prompt;

      expect(prompt).not.toContain('wirepro-cpa');
      expect(prompt).not.toContain('doc-1');
      expect(prompt).not.toContain('doc-2');
    });

    it('runs the transcript parser on a transcript it retrieved', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const parse = callTool.mock.calls.find(
        ([name]) => name === 'vault_parse_transcript'
      );
      expect(parse).toBeDefined();
      expect(parse?.[1]).toEqual({ documentId: 'doc-1' });
    });

    it('runs the tax schedule parser on a schedule it retrieved', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const parse = callTool.mock.calls.find(
        ([name]) => name === 'vault_parse_tax_schedule'
      );
      expect(parse).toBeDefined();
      expect(parse?.[1]).toEqual({ documentId: 'doc-2' });
    });

    it('reports what the parsers found so the model is not left to re-read the page', async () => {
      await service.queryDocuments(query, 'bearer-token');

      const generate = callTool.mock.calls.find(
        ([name]) => name === 'vault_generate'
      );
      const prompt: string = generate?.[1].prompt;

      expect(prompt).toContain('3:24-cv-01842-JLT');
      expect(prompt).toContain('1235989.45');
    });

    it('does not run a parser on a document of a kind it does not handle', async () => {
      callTool.mockImplementation(async (name: string) => {
        if (name === 'vault_search_documents') {
          return toolResult({
            ...SEARCH_RESULT,
            retrievedDocumentIds: ['doc-1'],
            excerpts: [SEARCH_RESULT.excerpts[0]],
          });
        }
        if (name === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (name === 'vault_generate') {
          return toolResult(modelSays(groundedAnswer));
        }
        throw new Error(`Unexpected tool ${name}`);
      });

      await service.queryDocuments(query, 'bearer-token');

      const names = callTool.mock.calls.map(([name]) => name);
      expect(names).not.toContain('vault_parse_tax_schedule');
    });
  });

  describe('the answer it reports', () => {
    it('returns the model own words with the real excerpt behind it', async () => {
      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.answer).toContain('went into the shredder');
      expect(result.model).toBe('qwen2.5-coder:14b');
      expect(result.airGapped).toBe(true);
    });

    it('drops a citation that names a passage it was never given', async () => {
      callTool.mockImplementation(async (name: string) => {
        if (name === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (name === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (name === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (name === 'vault_generate') {
          return toolResult(
            modelSays(
              JSON.stringify({
                answer: 'Both the shredder and the net profit.',
                citations: ['1', '9'],
              })
            )
          );
        }
        throw new Error(`Unexpected tool ${name}`);
      });

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].documentId).toBe('doc-1');
    });

    it('fails closed when the answer cites nothing it was given', async () => {
      callTool.mockImplementation(async (name: string) => {
        if (name === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (name === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (name === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (name === 'vault_generate') {
          return toolResult(
            modelSays(JSON.stringify({ answer: 'A guess.', citations: [] }))
          );
        }
        throw new Error(`Unexpected tool ${name}`);
      });

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.sources).toEqual([]);
      expect(result.airGapped).toBe(false);
      expect(result.answer).toMatch(/could not be grounded|cites nothing/i);
      expect(result.answer).not.toContain('A guess.');
    });
  });

  describe('failing closed', () => {
    const without = (name: string, failure: Error) => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === name) {
          throw failure;
        }
        if (tool === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (tool === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (tool === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (tool === 'vault_generate') {
          return toolResult(modelSays(groundedAnswer));
        }
        throw new Error(`Unexpected tool ${tool}`);
      });
    };

    it('reports an unreachable model instead of answering', async () => {
      without(
        'vault_generate',
        new Error('The local model could not be reached: ECONNREFUSED')
      );

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.answer).toMatch(/unavailable|could not be reached/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a refused non-local endpoint instead of answering', async () => {
      without(
        'vault_generate',
        new Error(
          'Vault air gap refused this request. "api.openai.com" resolves to 104.18.32.47, which is not on this network.'
        )
      );

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.answer).toMatch(/air gap/i);
    });

    it('fails closed when the model output cannot be parsed', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (tool === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (tool === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (tool === 'vault_generate') {
          return toolResult(modelSays('Sure! Here is what I found.'));
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.answer).not.toContain('Sure! Here is what I found.');
    });

    it('fails closed when the model result does not name the model that answered', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (tool === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (tool === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (tool === 'vault_generate') {
          return toolResult({ text: groundedAnswer });
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.model).toBe('none');
    });

    it('fails closed when the model emits JSON of the wrong shape', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult(SEARCH_RESULT);
        }
        if (tool === 'vault_parse_transcript') {
          return toolResult(TRANSCRIPT_PARSE);
        }
        if (tool === 'vault_parse_tax_schedule') {
          return toolResult(SCHEDULE_PARSE);
        }
        if (tool === 'vault_generate') {
          return toolResult(modelSays('{"answer": 42, "citations": "one"}'));
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      const result = await service.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
    });

    it('fails closed when retrieval returns nothing', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult({
            tenantId: 'wirepro-cpa',
            requestedDocumentIds: ['doc-1'],
            retrievedDocumentIds: [],
            unavailableDocumentIds: ['doc-1'],
            excerpts: [],
          });
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      const result = await service.queryDocuments(
        { ...query, documentIds: ['doc-1'] },
        'bearer-token'
      );

      expect(result.sources).toEqual([]);
      expect(result.airGapped).toBe(false);
      expect(result.answer).toMatch(/not available|no readable/i);
    });

    it('never asks the model anything when retrieval came back empty', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult({
            tenantId: 'wirepro-cpa',
            requestedDocumentIds: ['doc-1'],
            retrievedDocumentIds: [],
            unavailableDocumentIds: ['doc-1'],
            excerpts: [],
          });
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      await service.queryDocuments(
        { ...query, documentIds: ['doc-1'] },
        'bearer-token'
      );

      const names = callTool.mock.calls.map(([name]) => name);
      expect(names).not.toContain('vault_generate');
    });

    it('reports a document that belongs to somebody else without naming it', async () => {
      callTool.mockImplementation(async (tool: string) => {
        if (tool === 'vault_search_documents') {
          return toolResult({
            tenantId: 'wirepro-cpa',
            requestedDocumentIds: ['doc-memo'],
            retrievedDocumentIds: [],
            unavailableDocumentIds: ['doc-memo'],
            excerpts: [],
          });
        }
        throw new Error(`Unexpected tool ${tool}`);
      });

      const result = await service.queryDocuments(
        { ...query, documentIds: ['doc-memo'] },
        'bearer-token'
      );

      expect(result.airGapped).toBe(false);
      expect(JSON.stringify(result)).not.toContain('BLUE HARBOR');
    });

    it('refuses to act without a session credential', async () => {
      await expect(service.queryDocuments(query, undefined)).rejects.toThrow(
        /MCP session/i
      );
      expect(callTool).not.toHaveBeenCalled();
    });

    it('refuses to search the vault with no documents named', async () => {
      const result = await service.queryDocuments(
        { query: 'Anything at all?', tenantId: 'wirepro-cpa' },
        'bearer-token'
      );

      expect(result.airGapped).toBe(false);
      expect(callTool).not.toHaveBeenCalled();
    });

    it('fails closed when the MCP session cannot be opened', async () => {
      const tools = {
        session: jest
          .fn()
          .mockRejectedValue(new Error('Unauthorized: Token Invalid.')),
      };
      const scoped = new VaultCopilotService(
        { get: jest.fn() } as unknown as ConfigService,
        tools as unknown as ToolsService
      );

      const result = await scoped.queryDocuments(query, 'bearer-token');

      expect(result.airGapped).toBe(false);
      expect(result.sources).toEqual([]);
    });

    it('still throws when the caller carries no tenant at all', async () => {
      await expect(
        service.queryDocuments({ query: 'Any tenant data?' }, 'bearer-token')
      ).rejects.toThrow(/tenant/i);
      expect(callTool).not.toHaveBeenCalled();
    });
  });
});
