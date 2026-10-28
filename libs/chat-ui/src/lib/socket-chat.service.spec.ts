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
      off: jest.fn(),
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

  it('resolves acknowledged sends only after the server confirms persistence', async () => {
    const message = {
      id: 'stable-id',
      conversationId: 'conversation-1',
      content: 'retryable',
    } as ChatMessage;
    const pending = service.sendMessageWithAck(message);
    const ack = mockSocket.emit.mock.calls.find(
      ([event]: [string]) => event === 'message'
    )[2];
    expect(typeof ack).toBe('function');

    ack({ success: true, messageId: 'stable-id' });

    await expect(pending).resolves.toEqual({
      success: true,
      messageId: 'stable-id',
    });
  });

  it('rejects acknowledged sends when the gateway reports a denied write', async () => {
    const pending = service.sendMessageWithAck({
      id: 'stable-id',
      conversationId: 'conversation-1',
      content: 'retryable',
    } as ChatMessage);
    const ack = mockSocket.emit.mock.calls.find(
      ([event]: [string]) => event === 'message'
    )[2];

    ack({ success: false, statusCode: 403, message: 'Access was revoked' });

    await expect(pending).rejects.toMatchObject({ statusCode: 403 });
  });

  it('reuses a UUID for the same failed draft and creates a new UUID when edited', async () => {
    const draft = {
      conversationId: 'conversation-1',
      content: 'same exact draft',
      senderId: 'profile-1',
    };
    const first = service.sendDraftMessage(draft);
    const firstAck = mockSocket.emit.mock.calls.at(-1)[2];
    firstAck({ success: false, statusCode: 408, message: 'Timed out' });
    await expect(first).rejects.toMatchObject({ statusCode: 408 });

    const retry = service.sendDraftMessage(draft);
    const retryMessage = mockSocket.emit.mock.calls.at(-1)[1];
    expect(retryMessage.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(retryMessage.id).toBe(mockSocket.emit.mock.calls.at(-2)[1].id);
    mockSocket.emit.mock.calls.at(-1)[2]({
      success: true,
      messageId: retryMessage.id,
    });
    await expect(retry).resolves.toMatchObject({ success: true });

    const edited = service.sendDraftMessage({ ...draft, content: 'edited' });
    const editedMessage = mockSocket.emit.mock.calls.at(-1)[1];
    expect(editedMessage.id).not.toBe(retryMessage.id);
    mockSocket.emit.mock.calls.at(-1)[2]({
      success: true,
      messageId: editedMessage.id,
    });
    await expect(edited).resolves.toMatchObject({ success: true });
  });

  it('keeps the fallback draft ID in UUID format when randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { ...originalCrypto, randomUUID: undefined },
    });
    try {
      const pending = service.sendDraftMessage({
        conversationId: 'conversation-1',
        content: 'fallback id',
      });
      const [event, message, acknowledge] = mockSocket.emit.mock.calls.at(-1);
      expect(event).toBe('message');
      expect(message.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      acknowledge({ success: true, messageId: message.id });
      await expect(pending).resolves.toMatchObject({ success: true });
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('observes disconnect and reconnect events and removes only its listeners', () => {
    const callback = jest.fn();
    const dispose = service.onConnectionState(callback);
    const connect = mockSocket.on.mock.calls
      .filter(([event]: [string]) => event === 'connect')
      .at(-1)[1];
    const disconnect = mockSocket.on.mock.calls
      .filter(([event]: [string]) => event === 'disconnect')
      .at(-1)[1];

    connect();
    disconnect();
    dispose();

    expect(callback).toHaveBeenNthCalledWith(1, false);
    expect(callback).toHaveBeenNthCalledWith(2, true);
    expect(callback).toHaveBeenNthCalledWith(3, false);
    expect(mockSocket.off).toHaveBeenCalledWith('connect', connect);
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', disconnect);
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
    const dispose = service.onMessage(callback);
    const listener = mockSocket.on.mock.calls.find(
      ([event]: [string, unknown]) => event === 'message'
    )[1];
    listener({ id: 'm1', content: 'hello', timestamp: '2026-10-06T00:00:00Z' });
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        timestamp: new Date('2026-10-06T00:00:00Z'),
      })
    );
    dispose();
    expect(mockSocket.off).toHaveBeenCalledWith('message', listener);
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
  it('rejects old-session draft completion without unlocking a new-session draft', async () => {
    let finishOld!: (value: any) => void;
    let finishNew!: (value: any) => void;
    const acknowledgement = jest
      .spyOn(service, 'sendMessageWithAck')
      .mockImplementationOnce(
        (message) =>
          new Promise((resolve) => {
            finishOld = () =>
              resolve({ success: true, messageId: message.id! });
          })
      )
      .mockImplementationOnce(
        (message) =>
          new Promise((resolve) => {
            finishNew = () =>
              resolve({ success: true, messageId: message.id! });
          })
      );
    const message = { conversationId: 'shared', content: 'private draft' };
    const old = service.sendDraftMessage(message);
    const rejected = expect(old).rejects.toThrow('Chat session changed');
    service.destroy();
    const current = service.sendDraftMessage(message);
    finishOld(undefined);
    await rejected;
    await expect(service.sendDraftMessage(message)).rejects.toThrow(
      'A message is already being sent'
    );
    finishNew(undefined);
    await expect(current).resolves.toMatchObject({ success: true });
    expect(acknowledgement).toHaveBeenCalledTimes(2);
  });
});
