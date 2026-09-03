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

  function handlerFor(event: string): (...args: any[]) => void {
    const call = mockSocket.on.mock.calls.find((c: any[]) => c[0] === event);
    if (!call) {
      throw new Error(`no handler registered for ${event}`);
    }
    return call[1];
  }

  it('logs when the socket connects and disconnects', () => {
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    handlerFor('connect')();
    handlerFor('disconnect')();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Socket connected')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Socket disconnected')
    );
  });

  it('logs connection timeouts and reconnect attempts', () => {
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    handlerFor('connect_timeout')(5000);
    handlerFor('reconnect_attempt')(2);
    handlerFor('reconnect_failed')();
    handlerFor('reconnect')(3);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('timed out after 5000ms')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('reconnect attempt #2')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('reconnection failed')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('reconnected after 3 attempts')
    );
  });

  it('does not treat a non-auth connect_error as an authentication failure', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handlerFor('connect_error')({ message: 'network unreachable' });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('network unreachable')
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('authentication failed')
    );
  });

  it('handles connect_error auth failures without an authErrorHandler configured', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handlerFor('connect_error')({ message: 'jwt expired' });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('authentication failed')
    );
  });

  it('ignores generic error events that are not authorization failures', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handlerFor('error')('boom');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Socket error')
    );
  });

  it('handles authorization error objects on the error event', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handlerFor('error')({ type: 'UnauthorizedException' });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('authorization error')
    );
  });

  it('handles 401 status code error objects on the error event', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handlerFor('error')({ statusCode: 401 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('authorization error')
    );
  });

  it('requests conversations, reconnecting if needed first', () => {
    mockSocket.disconnected = true;
    service.getConversations('profile-1');
    expect(mockSocket.connect).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('get_conversations', {
      profileId: 'profile-1',
    });
  });

  it('registers callbacks for every socket event', () => {
    const cb = jest.fn();
    service.onConversations(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('conversations', cb);

    service.onAIStatusUpdate(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('ai_status_update', cb);

    service.onStreamingResponse(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('streaming_response', cb);

    service.onToolCallUpdate(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('tool_call_update', cb);

    service.onTypingIndicator(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('typing', cb);

    service.onPresenceUpdate(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('presence_update', cb);

    service.onPresenceBatch(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('presence_batch_response', cb);

    service.onReactionUpdate(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('reaction_update', cb);

    service.onReadReceipt(cb);
    expect(mockSocket.on).toHaveBeenCalledWith('read_receipt', cb);
  });

  it('emits payloads for every socket action', () => {
    service.sendInit('profile-1', 'persona-1', 'app-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('new_persona_chat', {
      profileId: 'profile-1',
      personaId: 'persona-1',
      appId: 'app-1',
    });

    service.sendTypingIndicator('conv-1', true);
    expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
      conversationId: 'conv-1',
      isTyping: true,
    });

    service.sendPresence('online');
    expect(mockSocket.emit).toHaveBeenCalledWith('presence', {
      status: 'online',
    });

    service.getPresenceBatch(['u1', 'u2']);
    expect(mockSocket.emit).toHaveBeenCalledWith('presence_batch', {
      userIds: ['u1', 'u2'],
    });

    service.sendReaction('msg-1', '👍');
    expect(mockSocket.emit).toHaveBeenCalledWith('reaction', {
      messageId: 'msg-1',
      emoji: '👍',
    });

    service.removeReaction('msg-1', '👍');
    expect(mockSocket.emit).toHaveBeenCalledWith('reaction_remove', {
      messageId: 'msg-1',
      emoji: '👍',
    });

    service.markAsRead('conv-1', ['msg-1', 'msg-2']);
    expect(mockSocket.emit).toHaveBeenCalledWith('mark_read', {
      conversationId: 'conv-1',
      messageIds: ['msg-1', 'msg-2'],
    });
  });

  it('builds the socket url from a configured host with a trailing slash', () => {
    const hostIo = jest.fn(() => mockSocket);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_HOST, useValue: 'https://example.com/' },
        { provide: SOCKET_NAMESPACE, useValue: 'chat' },
        { provide: SOCKET_IO_INSTANCE, useValue: hostIo },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(SocketChatService);
    expect(hostIo).toHaveBeenCalledWith(
      'https://example.com/chat',
      expect.any(Object)
    );
  });

  it('normalizes a namespace missing a leading slash', () => {
    const nsIo = jest.fn(() => mockSocket);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_HOST, useValue: '' },
        { provide: SOCKET_NAMESPACE, useValue: 'chat' },
        { provide: SOCKET_IO_INSTANCE, useValue: nsIo },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(SocketChatService);
    expect(nsIo).toHaveBeenCalledWith('/chat', expect.any(Object));
  });
});
