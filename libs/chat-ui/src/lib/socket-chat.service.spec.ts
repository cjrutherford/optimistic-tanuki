import {
  SOCKET_HOST,
  SOCKET_AUTH_TOKEN_PROVIDER,
  SOCKET_IO_INSTANCE,
  SOCKET_NAMESPACE,
  SOCKET_PATH,
  SocketChatService,
} from './socket-chat.service';

import { ChatMessage } from './types/message';
import { PLATFORM_ID } from '@angular/core';
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
      connect: jest.fn(),
    };
    mockIo = jest.fn(() => mockSocket);

    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_HOST, useValue: '' },
        { provide: SOCKET_NAMESPACE, useValue: 'chat' },
        { provide: SOCKET_PATH, useValue: '/ws' },
        { provide: SOCKET_IO_INSTANCE, useValue: mockIo },
        { provide: SOCKET_AUTH_TOKEN_PROVIDER, useValue: () => 'legacy-token' },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(SocketChatService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('uses the configured Socket.IO transport path', () => {
    expect(mockIo).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({ path: '/ws', withCredentials: true })
    );
  });

  it('accepts the legacy token provider while using cookie-based socket auth', () => {
    expect(mockIo).toHaveBeenCalledWith(
      '/chat',
      expect.not.objectContaining({ auth: expect.anything() })
    );
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

  it('reconnects a manually disconnected socket before sending a message', () => {
    mockSocket.disconnected = true;

    service.sendMessage({
      conversationId: '1',
      content: 'Hello',
      senderId: 'user1',
      recipientId: ['user2'],
      type: 'chat',
    });

    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('should register on message callback', () => {
    const callback = jest.fn();
    service.onMessage(callback);
    expect(mockSocket.on).toHaveBeenCalledWith('message', callback);
  });

  it('should disconnect socket on destroy', () => {
    service.destroy();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should warn if socket is not initialized on destroy', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    // @ts-ignore
    service['socket'] = undefined;
    service.destroy();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Socket was not initialized');
  });

  it('does not open a Socket.IO client while rendering on the server', () => {
    const serverIo = jest.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_HOST, useValue: '' },
        { provide: SOCKET_NAMESPACE, useValue: 'chat' },
        { provide: SOCKET_PATH, useValue: '/ws' },
        { provide: SOCKET_IO_INSTANCE, useValue: serverIo },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });

    TestBed.inject(SocketChatService);

    expect(serverIo).not.toHaveBeenCalled();
  });
});
