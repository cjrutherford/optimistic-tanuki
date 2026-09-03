import { TestBed } from '@angular/core/testing';

import { MessageService } from './message.service';
import { MessageType } from './message.type';

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a message', () => {
    const message: MessageType = { type: 'info', content: 'Test message' };
    service.addMessage(message);
    expect(service.messages()).toEqual([message]);
  });

  it('should clear all messages', () => {
    service.addMessage({ type: 'info', content: 'Test message 1' });
    service.addMessage({ type: 'info', content: 'Test message 2' });
    service.clearMessages();
    expect(service.messages()).toEqual([]);
  });

  it('should dismiss a message by index', () => {
    const message1: MessageType = { type: 'info', content: 'Test message 1' };
    const message2: MessageType = { type: 'info', content: 'Test message 2' };
    service.addMessage(message1);
    service.addMessage(message2);
    service.dismiss(0);
    expect(service.messages()).toEqual([message2]);
  });

  it('should not dismiss a message if index is out of bounds', () => {
    const message1: MessageType = { type: 'info', content: 'Test message 1' };
    service.addMessage(message1);
    service.dismiss(99);
    expect(service.messages()).toEqual([message1]);
    service.dismiss(-1);
    expect(service.messages()).toEqual([message1]);
  });
});

/**
 * Messages used to stay until somebody clicked them away, so every toast a
 * session produced was still on screen at the end of it. Three decisions in a
 * row covered the panel they were made in.
 */
describe('MessageService dismissing itself', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('takes an ordinary message away on its own', () => {
    const service = new MessageService();
    service.addMessage({ type: 'success', content: 'Approved and done.' });

    expect(service.messages()).toHaveLength(1);
    jest.advanceTimersByTime(6000);

    expect(service.messages()).toHaveLength(0);
  });

  it('leaves an error up, since that is the one worth reading twice', () => {
    const service = new MessageService();
    service.addMessage({ type: 'error', content: 'It did not go through' });

    jest.advanceTimersByTime(60000);

    expect(service.messages()).toHaveLength(1);
  });

  it('removes the right one when several are up', () => {
    const service = new MessageService();
    service.addMessage({ type: 'info', content: 'first' });
    jest.advanceTimersByTime(3000);
    service.addMessage({ type: 'info', content: 'second' });

    jest.advanceTimersByTime(3000);

    expect(service.messages().map((m) => m.content)).toEqual(['second']);
  });
});
