import { MessageService } from './message.service';

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    service = new MessageService();
  });

  it('starts with no messages', () => {
    expect(service.messages()).toEqual([]);
  });

  it('adds a message with an incrementing id', () => {
    const id1 = service.addMessage({ content: 'first', type: 'info' });
    const id2 = service.addMessage({ content: 'second', type: 'error' });

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(service.messages()).toEqual([
      { content: 'first', type: 'info', id: 1 },
      { content: 'second', type: 'error', id: 2 },
    ]);
  });

  it('success/error/info helpers add correctly typed messages', () => {
    service.success('yay');
    service.error('oops');
    service.info('fyi');

    expect(service.messages().map((m) => m.type)).toEqual([
      'success',
      'error',
      'info',
    ]);
  });

  it('removes a message by id', () => {
    const id = service.addMessage({ content: 'to remove', type: 'info' });
    service.addMessage({ content: 'stays', type: 'info' });

    service.removeMessage(id);

    expect(service.messages()).toHaveLength(1);
    expect(service.messages()[0].content).toBe('stays');
  });

  it('clears all messages', () => {
    service.addMessage({ content: 'a', type: 'info' });
    service.addMessage({ content: 'b', type: 'info' });

    service.clearMessages();

    expect(service.messages()).toEqual([]);
  });

  describe('dismiss', () => {
    it('removes the message at the given index', () => {
      service.addMessage({ content: 'a', type: 'info' });
      service.addMessage({ content: 'b', type: 'info' });

      service.dismiss(0);

      expect(service.messages()).toHaveLength(1);
      expect(service.messages()[0].content).toBe('b');
    });

    it('does nothing for an out-of-range index', () => {
      service.addMessage({ content: 'a', type: 'info' });

      service.dismiss(5);
      service.dismiss(-1);

      expect(service.messages()).toHaveLength(1);
    });
  });
});
