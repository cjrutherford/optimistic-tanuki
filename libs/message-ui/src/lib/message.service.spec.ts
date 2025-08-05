import { TestBed } from '@angular/core/testing';

import { MessageService } from './message.service';
import { MessageType } from './message/message.component';

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