import { AiAssistantBubbleComponent } from './ai-assistant-bubble.component';

/**
 * The assistant reachable from anywhere.
 *
 * What stood here was a placeholder that always said it was unavailable. It
 * was replaced by a real assistant on the projects page, which was honest and
 * meant it appeared nowhere else, so somebody who remembered the old bubble
 * would reasonably think the feature had gone.
 */
describe('AiAssistantBubbleComponent', () => {
  function bubbleWith(turns: unknown[] = []) {
    const component = new AiAssistantBubbleComponent();
    component.turns = turns as never;
    return component;
  }

  it('starts closed, so it does not sit over the page', () => {
    expect(bubbleWith().open).toBe(false);
  });

  it('opens and closes on the handle', () => {
    const bubble = bubbleWith();

    bubble.toggle();
    expect(bubble.open).toBe(true);

    bubble.toggle();
    expect(bubble.open).toBe(false);
  });

  describe('the unread count', () => {
    it('counts answers waiting behind a closed bubble', () => {
      // A run takes a minute or more, so the answer often arrives while
      // somebody is looking at something else.
      const bubble = bubbleWith([
        { role: 'person', text: 'a question' },
        { role: 'assistant', text: 'an answer' },
      ]);

      expect(bubble.unread).toBe(1);
    });

    it('counts nothing while it is open, since the answers are visible', () => {
      const bubble = bubbleWith([{ role: 'assistant', text: 'an answer' }]);

      bubble.toggle();

      expect(bubble.unread).toBe(0);
    });

    it('does not count what the reader said themselves', () => {
      const bubble = bubbleWith([{ role: 'person', text: 'a question' }]);

      expect(bubble.unread).toBe(0);
    });
  });
});

/**
 * The conversation the chat window is given, and why it must not be new every
 * time it is asked for.
 *
 * This was a plain getter building a fresh conversation with fresh message
 * objects and fresh timestamps. The window compares that input by reference,
 * so it scrolled to the bottom on every change detection pass, and the message
 * list tracked messages by identity, so it tore down and rebuilt every message
 * in the DOM on every pass. That is what the flashing was: not a render that
 * looked wrong, a render happening over and over.
 */
describe('AiAssistantBubbleComponent conversation', () => {
  function bubbleWith(turns: { role: 'person' | 'assistant'; text: string }[]) {
    const bubble = new AiAssistantBubbleComponent();
    bubble.turns = turns;
    bubble.personaId = 'p1';
    bubble.personaName = 'Patricia P. Project';
    return bubble;
  }

  it('hands back the same conversation when nothing has changed', () => {
    const bubble = bubbleWith([{ role: 'person', text: 'how many' }]);

    expect(bubble.conversation).toBe(bubble.conversation);
  });

  it('keeps timestamps still while nothing changes', () => {
    // They were minted per call, so the clock beside a message moved on its
    // own.
    const bubble = bubbleWith([{ role: 'person', text: 'how many' }]);

    const first = bubble.conversation.messages[0].timestamp;

    expect(bubble.conversation.messages[0].timestamp).toBe(first);
  });

  it('rebuilds when a turn is added', () => {
    const bubble = bubbleWith([{ role: 'person', text: 'how many' }]);
    const before = bubble.conversation;

    bubble.turns = [...bubble.turns, { role: 'assistant', text: 'twelve' }];

    expect(bubble.conversation).not.toBe(before);
    expect(bubble.conversation.messages).toHaveLength(2);
  });

  it('rebuilds while the answer is being written', () => {
    // The content genuinely changes on every chunk, so rebuilding then is
    // correct rather than wasteful.
    const bubble = bubbleWith([{ role: 'person', text: 'how many' }]);
    bubble.partial = 'There';
    const before = bubble.conversation;

    bubble.partial = 'There are';

    expect(bubble.conversation).not.toBe(before);
  });

  it('rebuilds when somebody else is being spoken to', () => {
    const bubble = bubbleWith([{ role: 'person', text: 'how many' }]);
    const before = bubble.conversation;

    bubble.personaId = 'p2';
    bubble.personaName = 'Percy Verse';

    expect(bubble.conversation).not.toBe(before);
  });

  it('rebuilds when a streamed draft is replaced by a different answer', () => {
    // Same number of turns, different words. Counting turns alone would miss
    // it and leave the draft on screen.
    const bubble = bubbleWith([{ role: 'assistant', text: 'a short draft' }]);
    const before = bubble.conversation;

    bubble.turns = [{ role: 'assistant', text: 'a rather longer real answer' }];

    expect(bubble.conversation).not.toBe(before);
    expect(bubble.conversation.messages[0].content).toBe(
      'a rather longer real answer'
    );
  });

  it('gives the persona a face rather than an empty photograph', () => {
    const bubble = bubbleWith([]);

    expect(bubble.speakingWith[0].avatarUrl).toMatch(/^data:image\/svg\+xml/);
  });
});

/**
 * What the indicator says while it works, which is the only thing there is to
 * read across most of a hundred second wait.
 */
describe('AiAssistantBubbleComponent thinking message', () => {
  function working(doing: string[], thinking = '') {
    const bubble = new AiAssistantBubbleComponent();
    bubble.working = true;
    bubble.doing = doing;
    bubble.thinking = thinking;
    return bubble;
  }

  it('promises a wait before any tool has been called', () => {
    expect(working([]).thinkingMessage).toContain('This takes a minute');
  });

  it('names each tool once, however often it was called', () => {
    // A loop searching the tasks three times read as "searched the tasks,
    // searched the tasks, searched the tasks", which says nothing the first
    // one did not.
    const message = working([
      'query_tasks',
      'query_tasks',
      'query_tasks',
    ]).thinkingMessage;

    expect(message).toBe('So far: searched the tasks.');
  });

  it('keeps distinct tools distinct', () => {
    const message = working(['count_tasks', 'list_risks']).thinkingMessage;

    expect(message).toBe('So far: counted the tasks, listed the risks.');
  });

  it('adds what it is chewing on', () => {
    const message = working(
      ['count_tasks'],
      'reading the numbers'
    ).thinkingMessage;

    expect(message).toContain('reading the numbers');
  });

  it('says nothing at all when it is not working', () => {
    const bubble = working(['count_tasks']);
    bubble.working = false;

    expect(bubble.thinkingMessage).toBeNull();
  });

  it('gets out of the way once the answer is arriving', () => {
    // Once there is text to read, a status line says less than the answer.
    const bubble = working(['count_tasks'], 'still musing');
    bubble.partial = 'There are';

    expect(bubble.thinkingMessage).toBeNull();
  });
});
