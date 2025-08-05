import {
  SOCKET_HOST,
  SOCKET_IO_INSTANCE,
  SOCKET_NAMESPACE,
  SocketChatService,
} from './socket-chat.service';

import { ChatMessage } from './types/message';
import { TestBed } from '@angular/core/testing';

describe('SocketChatService', () => {
  let service: SocketChatService;
  let mockSocket: any;
  let mockIo: any;

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    mockIo = jest.fn(() => mockSocket);

    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_HOST, useValue: 'http://localhost:3000' },
        { provide: SOCKET_NAMESPACE, useValue: 'chat' },
        { provide: SOCKET_IO_INSTANCE, useValue: mockIo },
      ],
    });
    service = TestBed.inject(SocketChatService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit message via socket', () => {
    const message: ChatMessage = {
      id: '1',
      conversationId: '1',
      senderId: 'user1',
      recipientId: ['user2'],
      content: 'Hello',
      timestamp: new Date(),
      type: 'chat',
    };
    service.sendMessage(message);
    expect(mockSocket.emit).toHaveBeenCalledWith('message', message);
  });

  it('should register on message callback', () => {
    const callback = jest.fn();
    service.onMessage(callback);
    expect(mockSocket.on).toHaveBeenCalledWith('message', callback);
  });

  it('should disconnect socket on ngOnDestroy', () => {
    service.ngOnDestroy();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should warn if socket is not initialized on ngOnDestroy', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    // @ts-ignore
    service['socket'] = undefined;
    service.ngOnDestroy();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Socket was not initialized');
  });
});
