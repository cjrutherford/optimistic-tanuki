import { ModelType } from './models/model-manager.service';
import {
  ProjectAgentService,
  rememberedTurns,
  saysAwaitingApproval,
  shortenKeepingBothEnds,
} from './project-agent.service';

/**
 * The agent acting through MCP, as the person who asked.
 *
 * Two things have to hold. It cannot act without the caller's token, because
 * the MCP surface decides what may be touched from who is asking. And when a
 * tool answers that something is waiting for approval, that has to survive
 * into the result: an agent reporting "created the task" over a proposal
 * nobody has looked at is the failure the gate exists to prevent, and it is
 * invisible if only the model's own words are kept.
 */
describe('ProjectAgentService', () => {
  function serviceWith({
    toolResult = { ok: true },
    said = 'Done.',
  }: { toolResult?: unknown; said?: string } = {}) {
    const callTool = jest.fn().mockResolvedValue(toolResult);
    const close = jest.fn().mockResolvedValue(undefined);
    const session = {
      listTools: jest.fn().mockResolvedValue([
        {
          name: 'create_task',
          description: 'Create a task',
          inputSchema: {
            properties: { title: {}, projectId: {} },
            required: ['title', 'projectId'],
          },
        },
      ]),
      callTool,
      close,
    };
    const tools = { session: jest.fn().mockResolvedValue(session) };

    // The agent loop is not under test here; what it does with the tools is.
    // Standing in for it keeps the test about this service.
    const invoke = jest.fn(async () => ({ messages: [{ content: said }] }));
    const models = {
      getModelConfig: jest.fn(() => ({ name: 'qwen3:8b' })),
      getModel: jest.fn(() => ({ bindTools: () => ({ invoke }) })),
    };

    const personas = {
      voiceFor: jest.fn().mockResolvedValue(null),
    };

    const service = new ProjectAgentService(
      models as never,
      tools as never,
      personas as never
    );
    return { service, tools, session, callTool, close, models, personas };
  }

  it('opens the session as the caller, not as itself', async () => {
    const { service, tools } = serviceWith();

    await service.act({
      instruction: 'add a task',
      projectId: 'p1',
      token: 'the-callers-token',
    });

    expect(tools.session).toHaveBeenCalledWith('the-callers-token');
  });

  it('closes the session even when the run fails', async () => {
    // A session is a connection made per credential. Leaving them open on the
    // failure path leaks one per failed request.
    const { service, close, models } = serviceWith();
    models.getModel.mockImplementation(() => {
      throw new Error('model is down');
    });

    const result = await service.act({
      instruction: 'add a task',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.unavailable).toBeTruthy();
    expect(close).toHaveBeenCalled();
  });

  it('says so rather than falling back when no model is configured', async () => {
    const { service, models, tools } = serviceWith();
    models.getModelConfig.mockImplementation(() => {
      throw new Error('No model configured for tool_calling');
    });

    const result = await service.act({
      instruction: 'add a task',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.unavailable).toMatch(/No model is configured/);
    expect(tools.session).not.toHaveBeenCalled();
  });

  describe('what the tools actually answered', () => {
    it('records the result of every call it makes', async () => {
      // The model's own account is the one thing that cannot be trusted to
      // reveal that nothing happened, so what the tools said is kept.
      const { service, session } = serviceWith();
      session.callTool.mockResolvedValue({
        content: [{ text: 'waiting for approval' }],
      });
      const used: { tool: string; result: string }[] = [];

      const tools = await service.toolsFor(session as never, used);
      await tools[0].func({ title: 'x', projectId: 'p1' });

      expect(used).toHaveLength(1);
      expect(used[0].tool).toBe('create_task');
      expect(used[0].result).toContain('waiting for approval');
    });

    it('reads waiting for approval out of what a tool returned', () => {
      expect(
        saysAwaitingApproval([
          {
            tool: 'create_task',
            result:
              'Task "x" was proposed and is waiting for approval. It has not happened yet.',
          },
        ])
      ).toBe(true);
    });

    it('does not report waiting when nothing was waiting', () => {
      expect(
        saysAwaitingApproval([
          { tool: 'create_task', result: 'Task "x" created successfully' },
        ])
      ).toBe(false);
    });

    it('builds a tool for each one the session offers', async () => {
      const { service, session } = serviceWith();

      const tools = await service.toolsFor(session as never, []);

      expect(tools.map((t) => t.name)).toEqual(['create_task']);
    });
  });

  /**
   * A voice on top of the rules, never instead of them.
   *
   * The seeded personas were written when these were advice chatbots, and
   * feeding one in as behaviour pushes a small model straight back into
   * describing its tool output and offering further analysis. Those rules are
   * the outcome of three separate attempts to stop exactly that, so the test
   * is not "does it have a persona" but "does the persona still leave the
   * rules standing, and last".
   */
  describe('speaking as somebody', () => {
    const patricia = {
      id: 'persona-1',
      name: 'Patricia P. Project',
      blurb: 'Works on your projects with you.',
      identityLines: [
        'You are Patricia P. Project.',
        'You come across as organized, empathetic and decisive.',
      ],
      tools: null,
    };

    /** The system prompt as the run would build it. */
    function promptFor(voice: unknown): string {
      const { service } = serviceWith();
      return service['systemPrompt']('p1', voice as never);
    }

    it('says who is speaking', () => {
      const prompt = promptFor(patricia);

      expect(prompt).toContain('You are Patricia P. Project.');
    });

    it('keeps every behavioural rule the persona could have displaced', () => {
      const withVoice = promptFor(patricia);
      const without = promptFor(null);

      // Whatever the persona adds, nothing it adds may remove.
      for (const rule of [
        'Answer the question you were actually asked',
        'never describe it',
        'not what you meant to happen',
        'waiting for approval',
      ]) {
        expect(without).toContain(rule);
        expect(withVoice).toContain(rule);
      }
    });

    it('puts the rules after the persona, closest to the task', () => {
      const prompt = promptFor(patricia);

      expect(prompt.indexOf('You are Patricia P. Project.')).toBeLessThan(
        prompt.indexOf('Answer the question you were actually asked')
      );
    });

    it('answers as nobody rather than not at all', async () => {
      // The telos service being unreachable costs a name, not a run.
      const { service, personas } = serviceWith();
      personas.voiceFor.mockResolvedValue(null);

      const result = await service.act({
        instruction: 'how many tasks',
        projectId: 'p1',
        token: 'token',
      });

      expect(result.spokenBy).toBeUndefined();
      expect(result.unavailable).toBeUndefined();
    });

    it('reports who answered, so a reader can be shown a name', async () => {
      const { service, personas } = serviceWith();
      personas.voiceFor.mockResolvedValue(patricia);

      const result = await service.act({
        instruction: 'how many tasks',
        projectId: 'p1',
        token: 'token',
      });

      expect(result.spokenBy).toEqual({
        id: 'persona-1',
        name: 'Patricia P. Project',
        blurb: 'Works on your projects with you.',
      });
    });
  });

  /**
   * The answer as it is written, rather than all at once at the end.
   *
   * The tools were already reported as they were used and then the reply
   * arrived whole after a silent stretch that is most of the wait. This model
   * produces it a token at a time and the tokens were being discarded.
   */
  describe('streaming the answer', () => {
    function composerYielding(pieces: string[]) {
      const { service, models } = serviceWith();
      models.getModel.mockReturnValue({
        bindTools: () => ({ invoke: jest.fn() }),
        invoke: jest.fn().mockResolvedValue({ content: pieces.join('') }),
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            for (const content of pieces) yield { content };
          })()
        ),
      });
      return { service, models };
    }

    const used = [{ tool: 'count_tasks', result: '{"total":12}' }];

    it('reports each piece as it is written', async () => {
      const { service } = composerYielding(['There are ', '12 tasks.']);
      const seen: string[] = [];

      await service.compose('how many', used, 'fallback', null, (chunk) =>
        seen.push(chunk)
      );

      expect(seen).toEqual(['There are ', '12 tasks.']);
    });

    it('returns the whole reply as well, so nothing depends on the pieces', async () => {
      const { service } = composerYielding(['There are ', '12 tasks.']);

      const said = await service.compose(
        'how many',
        used,
        'fallback',
        null,
        () => {
          /* listening, but the result is what is under test */
        }
      );

      expect(said).toBe('There are 12 tasks.');
    });

    it('does not stream when nobody is listening', async () => {
      // A stream nobody reads costs more than one call.
      const { service, models } = composerYielding(['whatever']);

      await service.compose('how many', used, 'fallback', null);

      expect(models.getModel().stream).not.toHaveBeenCalled();
    });

    it('falls back to the agent own words when nothing was written', async () => {
      // Whatever was streamed is replaced by what actually arrived, which is
      // what makes an empty compose safe rather than silent.
      const { service } = composerYielding([]);

      const said = await service.compose(
        'how many',
        used,
        'its own words',
        null,
        () => {
          /* nothing will arrive */
        }
      );

      expect(said).toBe('its own words');
    });

    it('says nothing when there was nothing to answer from', async () => {
      const { service } = composerYielding(['ignored']);
      const seen: string[] = [];

      await service.compose('how many', [], 'its own words', null, (chunk) =>
        seen.push(chunk)
      );

      expect(seen).toEqual([]);
    });
  });

  /**
   * Following the agent while it works.
   *
   * Measured on the running stack, a hundred second answer was sixty seconds
   * of silence before the first tool and forty more before the reply. Both are
   * a model reading and writing, and neither was reported. Streaming only the
   * composed reply covered well under one percent of the wait.
   */
  describe('reporting progress while it runs', () => {
    function agentYielding(pieces: unknown[]) {
      return {
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            for (const piece of pieces) yield piece;
          })()
        ),
        invoke: jest.fn().mockResolvedValue({
          messages: [{ content: 'from invoke' }],
        }),
      };
    }

    it('reports the words as the agent produces them', async () => {
      const { service } = serviceWith();
      const agent = agentYielding([
        ['messages', [{ content: 'I should ' }, { langgraph_node: 'agent' }]],
        [
          'messages',
          [{ content: 'count the tasks' }, { langgraph_node: 'agent' }],
        ],
        ['values', { messages: [{ content: 'done' }] }],
      ]);
      const heard: string[] = [];

      await service.runReportingProgress(agent as never, {}, (chunk) =>
        heard.push(chunk)
      );

      expect(heard).toEqual(['I should ', 'count the tasks']);
    });

    it('hands back the final messages, not the pieces', async () => {
      const { service } = serviceWith();
      const agent = agentYielding([
        ['messages', [{ content: 'thinking' }, { langgraph_node: 'agent' }]],
        ['values', { messages: [{ content: 'first' }, { content: 'last' }] }],
      ]);

      const messages = await service.runReportingProgress(
        agent as never,
        {},
        () => {
          /* listening */
        }
      );

      expect(messages.map((m) => m.content)).toEqual(['first', 'last']);
    });

    it('does not stream when nobody is following', async () => {
      const { service } = serviceWith();
      const agent = agentYielding([]);

      await service.runReportingProgress(agent as never, {});

      expect(agent.stream).not.toHaveBeenCalled();
      expect(agent.invoke).toHaveBeenCalled();
    });

    it('finishes plainly when it cannot be followed', async () => {
      // A run that finishes silently beats one that does not finish.
      const { service } = serviceWith();
      const agent = agentYielding([]);
      agent.stream.mockRejectedValue(new Error('no streaming here'));

      const messages = await service.runReportingProgress(
        agent as never,
        {},
        () => {
          /* listening */
        }
      );

      expect(agent.invoke).toHaveBeenCalled();
      expect(messages.map((m) => m.content)).toEqual(['from invoke']);
    });

    it('never repeats a tool result back as thinking', async () => {
      // A tool's result arrives on this stream too and its content is a
      // string, so a check for "is it text" passes and the raw JSON goes
      // straight to the reader.
      const { service } = serviceWith();
      const agent = agentYielding([
        [
          'messages',
          [
            { content: '{"content":[{"type":"text","text":"{...}"}]}' },
            { langgraph_node: 'tools' },
          ],
        ],
        ['values', { messages: [] }],
      ]);
      const heard: string[] = [];

      await service.runReportingProgress(agent as never, {}, (chunk) =>
        heard.push(chunk)
      );

      expect(heard).toEqual([]);
    });

    it('says what it is reaching for while it produces no words', async () => {
      // Deciding which tool to call produces no text at all, which is most of
      // the first minute.
      const { service } = serviceWith();
      const agent = agentYielding([
        [
          'messages',
          [
            { content: '', tool_call_chunks: [{ name: 'count_tasks' }] },
            { langgraph_node: 'agent' },
          ],
        ],
        ['values', { messages: [] }],
      ]);
      const heard: string[] = [];

      await service.runReportingProgress(agent as never, {}, (chunk) =>
        heard.push(chunk)
      );

      expect(heard.join('')).toContain('count_tasks');
    });

    it('ignores a piece with nothing readable in it', async () => {
      const { service } = serviceWith();
      const agent = agentYielding([
        ['messages', [{ content: '' }, { langgraph_node: 'agent' }]],
        [
          'messages',
          [{ content: [{ type: 'tool_use' }] }, { langgraph_node: 'agent' }],
        ],
        ['values', { messages: [] }],
      ]);
      const heard: string[] = [];

      await service.runReportingProgress(agent as never, {}, (chunk) =>
        heard.push(chunk)
      );

      expect(heard).toEqual([]);
    });
  });

  /**
   * Choosing a persona is meant to choose what can be done, so the scope is
   * read even though nothing sets it yet. Building the seam later would mean
   * every caller that binds tools had been written against the wrong shape.
   */
  describe('the tools a persona may reach', () => {
    it('binds every tool when the scope says nothing', async () => {
      const { service, session } = serviceWith();

      const bound = await service.toolsFor(
        session as never,
        [],
        undefined,
        null
      );

      expect(bound.map((tool) => tool.name)).toEqual(['create_task']);
    });

    it('binds only the tools in the scope', async () => {
      const { service, session } = serviceWith();

      const bound = await service.toolsFor(session as never, [], undefined, [
        'nothing_by_this_name',
      ]);

      expect(bound).toEqual([]);
    });

    it('never holds the tools that choose a persona', async () => {
      // The person chooses who they are talking to, in the menu. Bound here as
      // well, refer_to_persona offered to connect the reader with somebody
      // else, which nothing in the application can do.
      const { service, session } = serviceWith();
      session.listTools.mockResolvedValue([
        { name: 'count_tasks', inputSchema: { properties: {} } },
        { name: 'list_ai_personas', inputSchema: { properties: {} } },
        { name: 'get_ai_persona', inputSchema: { properties: {} } },
        { name: 'find_specialist_persona', inputSchema: { properties: {} } },
        { name: 'refer_to_persona', inputSchema: { properties: {} } },
      ]);

      const bound = await service.toolsFor(session as never, []);

      expect(bound.map((tool) => tool.name)).toEqual(['count_tasks']);
    });

    it('ignores a name no tool answers to rather than failing the run', async () => {
      // A stale scope should cost a capability, never the whole answer.
      const { service, session } = serviceWith();

      const bound = await service.toolsFor(session as never, [], undefined, [
        'create_task',
        'a_tool_that_was_removed',
      ]);

      expect(bound.map((tool) => tool.name)).toEqual(['create_task']);
    });
  });
});

/**
 * Carrying the conversation.
 *
 * Every instruction used to start cold, so "now assign it to me" had nothing
 * to attach to and the assistant asked what "it" was. The thread is held by
 * whoever is having the conversation and passed back in.
 */
describe('rememberedTurns', () => {
  const textsOf = (messages: unknown[]) =>
    messages.map((m) => String((m as { content: unknown }).content));

  it('carries earlier turns so a follow-up has something to refer to', () => {
    const messages = rememberedTurns(
      [
        { role: 'person', text: 'what is overdue?' },
        { role: 'assistant', text: 'Book the crane is overdue.' },
      ],
      12
    );

    expect(textsOf(messages)).toEqual([
      'what is overdue?',
      'Book the crane is overdue.',
    ]);
  });

  it('tells the model which side said what', () => {
    const [mine, theirs] = rememberedTurns(
      [
        { role: 'person', text: 'a question' },
        { role: 'assistant', text: 'an answer' },
      ],
      12
    );

    expect(mine.constructor.name).toContain('Human');
    expect(theirs.constructor.name).toContain('AI');
  });

  it('keeps only the recent ones, since the model re-reads every turn', () => {
    // A thread left to grow eventually costs more than it helps.
    const long = Array.from({ length: 40 }, (_, i) => ({
      role: 'person' as const,
      text: `turn ${i}`,
    }));

    const carried = textsOf(rememberedTurns(long, 12));

    expect(carried).toHaveLength(12);
    expect(carried).toContain('turn 39');
    expect(carried).not.toContain('turn 0');
  });

  it('copes with no history at all', () => {
    expect(rememberedTurns([], 12)).toEqual([]);
  });
});

/**
 * Who writes the sentence a person reads.
 *
 * The tool-calling model wrote it too, and was bad at it in a specific way:
 * asked for one task's status it fetched the tasks and then described the JSON
 * field by field, with a total of every duration and an offer to draw a Gantt
 * chart. The status was in the data and never said. Rewriting the prompt to
 * forbid exactly that changed nothing, so the job moved to the model chosen
 * for conversation.
 */
describe('ProjectAgentService composing the reply', () => {
  const RAMBLE = 'Here is a breakdown of the JSON structure…';
  const FOUND =
    '{"tasks":[{"title":"Strip the old liner","status":"IN_PROGRESS"}]}';

  function serviceWith({
    composed = 'Strip the old liner is in progress.',
    throws = false,
  } = {}) {
    const seen: unknown[][] = [];
    const models = {
      getModelConfig: jest.fn(() => ({ name: 'qwen3:8b' })),
      getModel: jest.fn((type: string) => {
        if (type !== ModelType.CONVERSATIONAL) return { bindTools: () => ({}) };
        return {
          invoke: async (messages: unknown[]) => {
            seen.push(messages);
            if (throws) throw new Error('conversational model is down');
            return { content: composed };
          },
        };
      }),
    };
    const service = new ProjectAgentService(models as never, {} as never);
    return { service, models, seen };
  }

  it('answers in the words of the model chosen for writing', async () => {
    const { service, models } = serviceWith();

    const said = await service.compose(
      'what is its status?',
      [{ tool: 'query_tasks', result: FOUND }],
      RAMBLE
    );

    expect(models.getModel).toHaveBeenCalledWith(ModelType.CONVERSATIONAL);
    expect(said).toBe('Strip the old liner is in progress.');
    expect(said).not.toContain('breakdown');
  });

  it('gives the composer the question and what the tools returned', async () => {
    const { service, seen } = serviceWith();

    await service.compose(
      'what is its status?',
      [{ tool: 'query_tasks', result: FOUND }],
      RAMBLE
    );

    const sent = seen[0]
      .map((m) => String((m as { content: unknown }).content))
      .join('\n');
    expect(sent).toContain('what is its status?');
    expect(sent).toContain('Strip the old liner');
  });

  it("keeps the agent's own words when nothing was looked up", async () => {
    // With no tool results the composer has nothing to answer from and would
    // be inventing.
    const { service, models } = serviceWith();

    const said = await service.compose('hello', [], 'Hello.');

    expect(said).toBe('Hello.');
    expect(models.getModel).not.toHaveBeenCalled();
  });

  it('falls back rather than losing the answer when composing fails', async () => {
    // A composed reply that fails is worse than a rambling one that arrived.
    const { service } = serviceWith({ throws: true });

    const said = await service.compose(
      'what is its status?',
      [{ tool: 'query_tasks', result: FOUND }],
      RAMBLE
    );

    expect(said).toBe(RAMBLE);
  });

  it('falls back when the composer answers with nothing at all', async () => {
    const { service } = serviceWith({ composed: '   ' });

    const said = await service.compose(
      'what is its status?',
      [{ tool: 'query_tasks', result: FOUND }],
      RAMBLE
    );

    expect(said).toBe(RAMBLE);
  });

  it('says so when a result was cut, rather than passing it off as whole', async () => {
    // Asked how many tasks a project had, it answered four. There were twelve.
    // The list had been shortened before it ever saw it and it counted what was
    // in front of it. A confident wrong number is worse than a refusal.
    const { service, seen } = serviceWith();

    await service.compose(
      'how many tasks are there?',
      [{ tool: 'list_tasks', result: 'x'.repeat(40000) }],
      RAMBLE
    );

    const sent = seen[0]
      .map((m) => String((m as { content: unknown }).content))
      .join('\n');
    expect(sent).toContain('SHORTENED');
    expect(sent).toContain('Never');
  });

  it('does not call a result shortened when all of it fits', async () => {
    const { service, seen } = serviceWith();

    await service.compose(
      'what is its status?',
      [{ tool: 'query_tasks', result: FOUND }],
      RAMBLE
    );

    const sent = seen[0]
      .map((m) => String((m as { content: unknown }).content))
      .join('\n');
    expect(sent).toContain('query_tasks returned:');
    expect(sent).not.toContain('SHORTENED, not the whole list');
  });
});

/**
 * Shortening a tool result without throwing away the answer.
 *
 * Taking the first N characters cost a correct one. list_tasks returned the
 * list and then the count, so on a nineteen thousand character result the count
 * sat at character 19,886 and the cut removed it. The model counted the visible
 * array by eye and said seven. The payload said twelve.
 */
describe('shortenKeepingBothEnds', () => {
  it('leaves a result that already fits completely alone', () => {
    expect(shortenKeepingBothEnds('short', 100)).toBe('short');
  });

  it('keeps the end, which is where a count tends to live', () => {
    const payload = `{"tasks":[${'x'.repeat(20000)}],"count":12}`;

    const shortened = shortenKeepingBothEnds(payload, 4000);

    expect(shortened).toContain('"count":12');
    expect(shortened.length).toBeLessThan(4200);
  });

  it('keeps the start too, which is where a summary tends to live', () => {
    const payload = `{"count":12,"tasks":[${'x'.repeat(20000)}]}`;

    expect(shortenKeepingBothEnds(payload, 4000)).toContain('"count":12');
  });

  it('says where the gap is rather than joining two halves silently', () => {
    // A reader that cannot see the join has no way to know it is looking at
    // two pieces of one list.
    const shortened = shortenKeepingBothEnds('y'.repeat(20000), 4000);

    expect(shortened).toContain('middle removed');
  });
});
