import {
  AssistantTurn,
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

    expect(conversation.participantProfiles).toContainEqual({
      id: 'p1',
      name: 'Patricia P. Project',
    });
  });

  it('still attributes turns when no persona could be read', () => {
    // Answering as nobody is a working state, and a message with no author
    // renders as "Unknown".
    const conversation = asConversation([answered], null);

    expect(conversation.messages[0].senderId).toBe(NOBODY_IN_PARTICULAR);
    expect(conversation.participantProfiles).toContainEqual({
      id: NOBODY_IN_PARTICULAR,
      name: 'Assistant',
    });
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
