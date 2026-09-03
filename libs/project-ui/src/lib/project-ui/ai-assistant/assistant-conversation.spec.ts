import {
  AssistantTurn,
  describeOperation,
  proposalIn,
  NOBODY_IN_PARTICULAR,
  READER,
  asConversation,
  describeTool,
  sawOnlyPartOfAList,
  wasProposed,
} from './assistant-conversation';

/**
 * The translation between the assistant's thread and a chat window.
 *
 * All of this used to live in a second chat implementation built beside a
 * library that already had one. What is kept here is the part that library
 * should never have to know: what a tool name means, what a proposal is, and
 * when an answer was drawn from part of a list.
 */
describe('asConversation', () => {
  const answered: AssistantTurn = {
    role: 'assistant',
    text: 'There are 12 tasks.',
    used: [{ tool: 'count_tasks', result: '{"total":12}' }],
  };

  const patricia = { id: 'p1', name: 'Patricia P. Project' };

  it('attributes each turn to the person or the persona', () => {
    const conversation = asConversation(
      [{ role: 'person', text: 'how many' }, answered],
      patricia
    );

    expect(conversation.messages.map((m) => m.senderId)).toEqual([
      READER,
      'p1',
    ]);
  });

  it('names the persona, so the window can show who is speaking', () => {
    const conversation = asConversation([answered], patricia);

    expect(conversation.participantProfiles).toContainEqual(
      expect.objectContaining({ id: 'p1', name: 'Patricia P. Project' })
    );
  });

  it('still attributes turns when no persona could be read', () => {
    // Answering as nobody is a working state, and a message with no author
    // renders as "Unknown".
    const conversation = asConversation([answered], null);

    expect(conversation.messages[0].senderId).toBe(NOBODY_IN_PARTICULAR);
    expect(conversation.participantProfiles).toContainEqual(
      expect.objectContaining({ id: NOBODY_IN_PARTICULAR, name: 'Assistant' })
    );
  });

  it('gives everyone in the thread a face', () => {
    // A persona telos has no field for a photograph, and an empty one showed
    // a broken external placeholder.
    const conversation = asConversation([answered], patricia);

    for (const profile of conversation.participantProfiles ?? []) {
      expect(profile.avatarUrl).toMatch(/^data:image\/svg\+xml/);
    }
  });

  describe('what it did, beside what it said', () => {
    it('carries the tools it used, in words', () => {
      const conversation = asConversation([answered], patricia);

      expect(conversation.messages[0].assistant?.did).toEqual([
        { what: 'counted the tasks', pending: false },
      ]);
    });

    it('marks a call that was proposed rather than carried out', () => {
      const conversation = asConversation(
        [
          {
            role: 'assistant',
            text: 'Done.',
            used: [
              {
                tool: 'create_task',
                result: 'proposed and is waiting for approval',
              },
            ],
          },
        ],
        patricia
      );

      expect(conversation.messages[0].assistant?.did?.[0].pending).toBe(true);
    });

    it('says plainly when nothing has happened yet', () => {
      const conversation = asConversation(
        [{ ...answered, awaitingApproval: true }],
        patricia
      );

      expect(conversation.messages[0].assistant?.awaiting).toMatch(
        /Nothing has happened yet/
      );
    });

    it('warns when the answer came from part of a list', () => {
      const conversation = asConversation(
        [
          {
            role: 'assistant',
            text: 'Most are done.',
            used: [
              {
                tool: 'list_tasks',
                result: '{"count":200,"showing":25,"more":true}',
              },
            ],
          },
        ],
        patricia
      );

      expect(conversation.messages[0].assistant?.caution).toMatch(
        /only saw part of that list/
      );
    });

    it('puts no note on what the person said', () => {
      const conversation = asConversation(
        [{ role: 'person', text: 'how many' }],
        patricia
      );

      expect(conversation.messages[0].assistant).toBeUndefined();
    });

    it('marks a failed turn so it does not read as an answer', () => {
      const conversation = asConversation(
        [{ role: 'assistant', text: 'Could not be reached.', failed: true }],
        patricia
      );

      expect(conversation.messages[0].type).toBe('warning');
    });
  });

  describe('while the answer is being written', () => {
    it('shows it as a turn, where the finished one will be', () => {
      const conversation = asConversation([], patricia, 'There are 12');

      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0].content).toBe('There are 12');
      expect(conversation.messages[0].senderId).toBe('p1');
    });

    it('adds nothing when nothing is being written', () => {
      const conversation = asConversation([answered], patricia, '');

      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0].id).toBe('turn-0');
    });

    it('puts the part being written after the turns already said', () => {
      const conversation = asConversation(
        [{ role: 'person', text: 'how many' }],
        patricia,
        'There are'
      );

      expect(conversation.messages.map((m) => m.content)).toEqual([
        'how many',
        'There are',
      ]);
    });
  });

  /**
   * Digging the proposal out of what the tool returned.
   *
   * The gate answers with the change it created, and that travels back wrapped
   * in an MCP content envelope and stringified again by the agent. Two parses
   * down. Every step is guarded, because a result that will not parse should
   * cost the buttons and never the answer.
   */
  describe('the proposal a gated tool filed', () => {
    /** A result shaped exactly as one arrives from the running stack. */
    function gatedResult(proposal: unknown): string {
      return JSON.stringify({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Task was proposed and is waiting for approval.',
              proposal,
              awaitingApproval: true,
            }),
          },
        ],
      });
    }

    it('finds the id through the envelope and both parses', () => {
      const found = proposalIn({
        result: gatedResult({ id: 'change-1', operation: 'task.create' }),
      });

      expect(found).toEqual({ id: 'change-1', what: 'creating that task' });
    });

    it('offers a decision on the turn that proposed it', () => {
      const conversation = asConversation(
        [
          {
            role: 'assistant',
            text: 'I have proposed that.',
            awaitingApproval: true,
            used: [
              {
                tool: 'create_task',
                result: gatedResult({
                  id: 'change-1',
                  operation: 'task.create',
                }),
              },
            ],
          },
        ],
        patricia
      );

      expect(conversation.messages[0].assistant?.decisions).toEqual([
        { id: 'change-1', what: 'creating that task' },
      ]);
    });

    it('offers nothing when the tool simply did the thing', () => {
      // Ungated projects apply immediately, and there is nothing to decide.
      const found = proposalIn({
        result: JSON.stringify({ success: true, taskId: 't1' }),
      });

      expect(found).toBeNull();
    });

    it('costs the buttons and not the answer when a result will not parse', () => {
      expect(proposalIn({ result: 'not json at all' })).toBeNull();
      expect(
        proposalIn({ result: '{"content":[{"text":"also not json"}]}' })
      ).toBeNull();
      expect(
        proposalIn({ result: gatedResult({ operation: 'task.create' }) })
      ).toBeNull();
      expect(proposalIn({ result: gatedResult({ id: 42 }) })).toBeNull();
    });

    it('reads an operation it has never seen, rather than showing the constant', () => {
      // Guessing these as CREATE_TASK put "Approve task.create" on a button.
      // Every real operation fell through the fallback and nothing failed.
      const found = proposalIn({
        result: gatedResult({ id: 'c1', operation: 'kilnLining.archive' }),
      });

      expect(found?.what).toBe('archive the kiln lining');
    });

    it('names every operation the gate actually files', () => {
      const named = [
        'task.create',
        'task.update',
        'taskNote.create',
        'risk.create',
        'projectJournal.create',
      ].map((operation) => describeOperation(operation));

      // None of them may read back as the operation itself.
      expect(named.some((what) => what.includes('.'))).toBe(false);
    });
  });

  describe('describeTool', () => {
    it('says what a tool did rather than naming an endpoint', () => {
      expect(describeTool('count_tasks')).toBe('counted the tasks');
    });

    it('falls back to readable words for a tool it does not know', () => {
      expect(describeTool('some_new_tool')).toBe('some new tool');
    });
  });

  describe('reading the tools rather than the model', () => {
    it('finds a proposal in what the tool returned', () => {
      expect(wasProposed({ result: 'Task "x" is waiting for approval.' })).toBe(
        true
      );
    });

    it('finds a shortened result', () => {
      expect(
        sawOnlyPartOfAList({
          role: 'assistant',
          text: 'x',
          used: [{ tool: 'list_tasks', result: 'returned (SHORTENED)' }],
        })
      ).toBe(true);
    });

    it('stays quiet when the whole list came back', () => {
      expect(
        sawOnlyPartOfAList({
          role: 'assistant',
          text: 'x',
          used: [{ tool: 'list_tasks', result: '{"count":3,"more":false}' }],
        })
      ).toBe(false);
    });
  });
});
