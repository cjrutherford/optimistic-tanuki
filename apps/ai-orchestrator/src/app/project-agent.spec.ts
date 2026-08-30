import {
  ProjectAgentService,
  rememberedTurns,
  saysAwaitingApproval,
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

    const service = new ProjectAgentService(models as never, tools as never);
    return { service, tools, session, callTool, close, models };
  }

  it('opens the session as the caller, not as itself', async () => {
    const { service, tools } = serviceWith();

    await service.act('add a task', 'p1', 'the-callers-token');

    expect(tools.session).toHaveBeenCalledWith('the-callers-token');
  });

  it('closes the session even when the run fails', async () => {
    // A session is a connection made per credential. Leaving them open on the
    // failure path leaks one per failed request.
    const { service, close, models } = serviceWith();
    models.getModel.mockImplementation(() => {
      throw new Error('model is down');
    });

    const result = await service.act('add a task', 'p1', 'token');

    expect(result.unavailable).toBeTruthy();
    expect(close).toHaveBeenCalled();
  });

  it('says so rather than falling back when no model is configured', async () => {
    const { service, models, tools } = serviceWith();
    models.getModelConfig.mockImplementation(() => {
      throw new Error('No model configured for tool_calling');
    });

    const result = await service.act('add a task', 'p1', 'token');

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
