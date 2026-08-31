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
