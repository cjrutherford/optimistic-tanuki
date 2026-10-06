import {
  buildOllamaResponseSchema,
  OLLAMA_RESPONSE_SCHEMAS,
  requestChatCompletion,
  StrictLlmError,
} from '../src/gateway.js';

async function captureRejection(
  p: Promise<unknown> | (() => Promise<unknown>)
): Promise<unknown> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}
describe('strict Ollama gateway', () => {
  it('posts OpenAI-compatible structured JSON requests and returns raw metadata', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const response = new Response(
      JSON.stringify({
        model: 'qwen3:8b',
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
      { status: 200 }
    );
    const result = await requestChatCompletion({
      baseUrl: 'http://test.local/v1/',
      model: 'qwen3:8b',
      timeoutMs: 100,
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return response;
      },
    });
    expect(calls[0].url).toBe('http://test.local/v1/chat/completions');
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.model).toBe('qwen3:8b');
    expect(body.response_format).toStrictEqual({ type: 'json_object' });
    expect(result.content).toBe('{"ok":true}');
    expect(result.raw['model']).toBe('qwen3:8b');
    // usage is parsed inside fetch's realm, so compare structure, not constructor.
    expect(result.usage).toEqual({
      prompt_tokens: 3,
      completion_tokens: 2,
      total_tokens: 5,
    });
    expect(result.latencyMs >= 0).toBeTruthy();
  });

  it('uses native Ollama /api/chat with context size, thinking off, and the schema as format', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await requestChatCompletion({
      baseUrl: 'http://gpu.local:11434/v1',
      model: 'qwen3:8b',
      operation: 'cluster',
      timeoutMs: 100,
      evidence: [{ sourceKey: 'town-news', civicItemId: 17 }],
      generation: { temperature: 0, seed: 17, numCtx: 16384 },
      messages: [{ role: 'user', content: 'user' }],
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            model: 'qwen3:8b',
            message: { role: 'assistant', content: '{"ok":true}' },
            prompt_eval_count: 900,
            eval_count: 12,
          }),
          { status: 200 }
        );
      },
    });
    expect(calls[0].url).toBe('http://gpu.local:11434/api/chat');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<
      string,
      unknown
    >;
    expect({
      stream: body['stream'],
      think: body['think'],
      options: body['options'],
    }).toStrictEqual({
      stream: false,
      think: false,
      options: { temperature: 0, seed: 17, num_ctx: 16384 },
    });
    expect(body['format']).toStrictEqual(
      buildOllamaResponseSchema('cluster', [
        { sourceKey: 'town-news', civicItemId: 17 },
      ])
    );
    expect(result.content).toBe('{"ok":true}');
    expect(result.usage).toStrictEqual({
      prompt_tokens: 900,
      completion_tokens: 12,
    });
  });

  it('fails a native Ollama response whose prompt filled the context window (silently truncated)', async () => {
    await expect(
      ((error: unknown) =>
        error instanceof StrictLlmError &&
        error.code === 'invalid' &&
        /truncated/u.test(error.message))(
        await captureRejection(() =>
          requestChatCompletion({
            baseUrl: 'http://gpu.local:11434',
            model: 'qwen3:8b',
            timeoutMs: 100,
            generation: { numCtx: 4096 },
            messages: [{ role: 'user', content: 'long prompt' }],
            fetchImpl: async () =>
              new Response(
                JSON.stringify({
                  model: 'qwen3:8b',
                  message: { content: '{"ok":true}' },
                  prompt_eval_count: 4096,
                }),
                { status: 200 }
              ),
          })
        )
      )
    ).toBe(true);
  });

  it('posts an operation-specific strict JSON Schema when an operation is supplied', async () => {
    const calls: { init?: RequestInit }[] = [];
    const response = new Response(
      JSON.stringify({
        model: 'qwen3:8b',
        choices: [
          {
            message: {
              content:
                '{"headline":"Roads","summary":"Update","whyItMatters":"Plan","citations":[]}',
            },
          },
        ],
      }),
      { status: 200 }
    );
    await requestChatCompletion({
      baseUrl: 'http://test.local/v1',
      model: 'qwen3:8b',
      operation: 'cluster',
      timeoutMs: 100,
      evidence: [{ sourceKey: 'town-news', civicItemId: 17 }],
      messages: [{ role: 'user', content: 'user' }],
      fetchImpl: async (_url, init) => {
        calls.push({ init });
        return response;
      },
    });
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<
      string,
      unknown
    >;
    expect(body['response_format']).toStrictEqual({
      type: 'json_schema',
      json_schema: {
        name: 'civic_cluster_response',
        strict: true,
        schema: buildOllamaResponseSchema('cluster', [
          { sourceKey: 'town-news', civicItemId: 17 },
        ]),
      },
    });
  });

  it('rejects operation requests without an explicit non-empty evidence set before transport', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response('unexpected', { status: 500 });
    };
    for (const evidence of [undefined, []] as const) {
      await expect(
        ((error: unknown) =>
          error instanceof StrictLlmError && error.code === 'invalid')(
          await captureRejection(() =>
            requestChatCompletion({
              baseUrl: 'http://test.local/v1',
              model: 'qwen3:8b',
              operation: 'cluster',
              evidence,
              messages: [{ role: 'user', content: 'user' }],
              fetchImpl,
            } as any)
          )
        )
      ).toBe(true);
    }
    expect(calls).toBe(0);
  });

  it('rejects evidence without an operation instead of silently changing legacy mode', async () => {
    let calls = 0;
    await expect(
      ((error: unknown) =>
        error instanceof StrictLlmError && error.code === 'invalid')(
        await captureRejection(() =>
          requestChatCompletion({
            baseUrl: 'http://test.local/v1',
            model: 'qwen3:8b',
            evidence: [{ sourceKey: 'town-news', civicItemId: 17 }],
            messages: [{ role: 'user', content: 'user' }],
            fetchImpl: async () => {
              calls += 1;
              return new Response('unexpected', { status: 500 });
            },
          } as any)
        )
      )
    ).toBe(true);
    expect(calls).toBe(0);
  });

  it('keeps every operation schema closed and requires its validator boundary fields', () => {
    expect(Object.keys(OLLAMA_RESPONSE_SCHEMAS)).toStrictEqual([
      'cluster',
      'brief',
      'brief_plan',
      'story',
      'agenda_fixup',
    ]);
    for (const schema of Object.values(OLLAMA_RESPONSE_SCHEMAS)) {
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
      expect(
        Array.isArray(schema.required) && schema.required.length > 0
      ).toBeTruthy();
    }
    expect(OLLAMA_RESPONSE_SCHEMAS.story.properties.status.enum).toStrictEqual([
      'decided',
      'pending',
      'ongoing',
    ]);
    expect(
      OLLAMA_RESPONSE_SCHEMAS.story.properties.claims.items.required
    ).toStrictEqual(['text', 'citations']);
  });

  it('describes internal citation identities as citation-only and forbids them in public prose', () => {
    const proseDescriptions = [
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.headline.description,
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.summary.description,
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.whyItMatters.description,
      OLLAMA_RESPONSE_SCHEMAS.brief.properties.headline.description,
      OLLAMA_RESPONSE_SCHEMAS.brief.properties.paragraphs.items.properties
        .claims.items.properties.text.description,
      OLLAMA_RESPONSE_SCHEMAS.story.properties.title.description,
      OLLAMA_RESPONSE_SCHEMAS.story.properties.claims.items.properties.text
        .description,
      OLLAMA_RESPONSE_SCHEMAS.agenda_fixup.properties.items.items.properties
        .heading.description,
      OLLAMA_RESPONSE_SCHEMAS.agenda_fixup.properties.items.items.properties
        .body.description,
    ];
    for (const description of proseDescriptions) {
      expect(String(description)).toMatch(/sourceKey|civicItemId/i);
      expect(String(description)).toMatch(/only.*citation|citation.*only/i);
      expect(String(description)).toMatch(/never|do not|must not/i);
    }
  });

  it('constrains public prose fields away from internal citation marker text', () => {
    const proseSchemas: any[] = [
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.headline,
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.summary,
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.whyItMatters,
      OLLAMA_RESPONSE_SCHEMAS.brief.properties.headline,
      OLLAMA_RESPONSE_SCHEMAS.brief.properties.paragraphs.items.properties
        .claims.items.properties.text,
      OLLAMA_RESPONSE_SCHEMAS.story.properties.title,
      OLLAMA_RESPONSE_SCHEMAS.story.properties.claims.items.properties.text,
    ];
    for (const schema of proseSchemas)
      expect(String(schema.description)).toMatch(/opaque|marker|never.*prose/i);
  });

  it('describes limitation fields as omit-when-absent plain text', () => {
    const limitationDescriptions = [
      OLLAMA_RESPONSE_SCHEMAS.cluster.properties.limitation.description,
      OLLAMA_RESPONSE_SCHEMAS.brief.properties.paragraphs.items.properties
        .claims.items.properties.limitation.description,
      OLLAMA_RESPONSE_SCHEMAS.story.properties.limitation.description,
    ];
    for (const description of limitationDescriptions) {
      expect(String(description)).toMatch(/optional.*plain-text/i);
      expect(String(description)).toMatch(
        /omit.*field.*no substantive limitation/i
      );
      expect(String(description)).toMatch(
        /None.*N\/A.*Not Applicable.*optional/i
      );
    }
  });

  it('builds an exact, closed citation union for every operation from request evidence', () => {
    const evidence = [
      { sourceKey: 'town-news', civicItemId: 17 },
      { sourceKey: 'official-record', civicItemId: 9007199254740001 },
    ];
    for (const operation of [
      'cluster',
      'brief',
      'story',
      'agenda_fixup',
    ] as const) {
      const schema = buildOllamaResponseSchema(operation, evidence) as Record<
        string,
        any
      >;
      const citations =
        operation === 'cluster'
          ? schema['properties'].citations.items
          : operation === 'brief'
          ? schema['properties'].paragraphs.items.properties.claims.items
              .properties.citations.items
          : operation === 'story'
          ? schema['properties'].claims.items.properties.citations.items
          : schema['properties'].items.items.properties.citations.items;
      expect(Array.isArray(citations.oneOf)).toBe(true);
      expect(
        citations.oneOf.map((entry: any) => [
          entry.properties.sourceKey.const,
          entry.properties.civicItemId.const,
        ])
      ).toStrictEqual([
        ['official-record', 9007199254740001],
        ['town-news', 17],
      ]);
      for (const entry of citations.oneOf) {
        expect(entry.additionalProperties).toBe(false);
        expect(entry.required).toStrictEqual(['sourceKey', 'civicItemId']);
        expect('articleUrl' in entry.properties).toBe(false);
        expect('snippetOnly' in entry.properties).toBe(false);
      }
    }
  });

  it('fails closed for empty or oversized evidence sets', () => {
    expect(() => buildOllamaResponseSchema('cluster', [])).toThrow(
      /evidence|non-empty/i
    );
    expect(() =>
      buildOllamaResponseSchema(
        'cluster',
        Array.from({ length: 300 }, (_, index) => ({
          sourceKey: `source-${index}`,
          civicItemId: index + 1,
        }))
      )
    ).toThrow(/bounded|large|limit|size/i);
  });

  it('sends a fresh evidence-bound schema for each request without leaking prior evidence', async () => {
    const requests: Record<string, any>[] = [];
    const response = new Response(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      { status: 200 }
    );
    const run = (sourceKey: string, civicItemId: number) =>
      requestChatCompletion({
        baseUrl: 'http://test.local/v1',
        model: 'qwen3:8b',
        operation: 'cluster',
        evidence: [{ sourceKey, civicItemId }],
        messages: [{ role: 'user', content: 'user' }],
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return response.clone();
        },
      });
    await run('first-source', 1);
    await run('second-source', 2);
    const first = requests[0]['response_format'].json_schema.schema as any;
    const second = requests[1]['response_format'].json_schema.schema as any;
    expect(
      first.properties.citations.items.oneOf.map(
        (entry: any) => entry.properties.sourceKey.const
      )
    ).toStrictEqual(['first-source']);
    expect(
      second.properties.citations.items.oneOf.map(
        (entry: any) => entry.properties.sourceKey.const
      )
    ).toStrictEqual(['second-source']);
  });

  it('throws typed errors for non-2xx, timeout, and empty content', async () => {
    await expect(
      (() =>
        requestChatCompletion({
          baseUrl: 'http://x',
          model: 'm',
          messages: [],
          fetchImpl: async () => new Response('bad', { status: 503 }),
        }))()
    ).rejects.toThrow(StrictLlmError);
    await expect(
      (() =>
        requestChatCompletion({
          baseUrl: 'http://x',
          model: 'm',
          timeoutMs: 5,
          messages: [],
          fetchImpl: async (_u, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError'))
              );
            }),
        }))()
    ).rejects.toThrow(/timeout|aborted/i);
    await expect(
      (() =>
        requestChatCompletion({
          baseUrl: 'http://x',
          model: 'm',
          messages: [],
          fetchImpl: async () =>
            new Response(
              JSON.stringify({ choices: [{ message: { content: ' ' } }] }),
              { status: 200 }
            ),
        }))()
    ).rejects.toThrow(/empty/i);
  });
});
