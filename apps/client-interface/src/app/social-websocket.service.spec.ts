import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SocialWebSocketService } from './social-websocket.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './state/auth-state.service';
import { PLATFORM_ID } from '@angular/core';
import { io } from 'socket.io-client';
import { Router } from '@angular/router';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

describe('SocialWebSocketService', () => {
  let service: SocialWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: API_BASE_URL,
          useValue: 'http://localhost:3000/api',
        },
        {
          provide: AuthStateService,
          useValue: {
            getToken: jest.fn().mockReturnValue(null),
            getDecodedTokenValue: jest.fn(),
            getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
            isAuthenticated: jest.fn().mockReturnValue(false),
          },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(SocialWebSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have connection status observable', () => {
    const status$ = service.getConnectionStatus();
    expect(status$).toBeTruthy();
  });

  it('should trigger exponential backoff on disconnection', () => {
    jest.useFakeTimers();
    try {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      service['reconnectWithBackoff']();
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      jest.runAllTimers();
      setTimeoutSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should have posts observable', () => {
    const posts$ = service.getPosts();
    expect(posts$).toBeTruthy();
  });

  it('should not be connected initially', () => {
    expect(service.isConnected()).toBeFalsy();
  });

  it('uses the runtime socket path for the production social connection', () => {
    const mockSocket = {
      on: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
    };
    (io as jest.Mock).mockReturnValue(mockSocket);
    (
      window as Window & {
        env?: { SOCKET_URL?: string; SOCKET_PATH?: string };
      }
    ).env = {
      SOCKET_URL: 'https://optimistic-tanuki.com',
      SOCKET_PATH: '/ws',
    };

    service.connect();

    expect(io).toHaveBeenCalledWith(
      'https://optimistic-tanuki.com/social',
      expect.objectContaining({
        path: '/ws',
        withCredentials: true,
      })
    );
    const [, socketOptions] = (io as jest.Mock).mock.calls[0];
    expect(socketOptions.auth).toBeUndefined();
    expect(socketOptions.extraHeaders).toBeUndefined();

    delete (window as Window & { env?: unknown }).env;
  });

  it('should disconnect cleanly', () => {
    expect(() => service.disconnect()).not.toThrow();
  });

  it('should emit connection errors when reconnection fails', (done) => {
    service.getConnectionError().subscribe((error) => {
      if (error) {
        expect(error).toBe('Unable to reconnect after multiple attempts.');
        done();
      }
    });

    service['reconnectAttempts'] = service['maxReconnectAttempts'];
    service['reconnectWithBackoff']();
  });

  it('should update posts$ on post_created event', () => {
    const mockPost = { id: '1', content: 'Test Post' } as any;
    service['posts$'].next([]);
    service['setupSocketListeners']();
    service['socket']?.emit('post_created', mockPost);
    service.getPosts().subscribe((posts) => {
      expect(posts).toContain(mockPost);
    });
  });
  it('should clear timeouts on destroy', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    service['reconnectTimeoutId'] = setTimeout(() => {
      /* noop */
    }, 1000);
    service.ngOnDestroy();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('SocialWebSocketService socket lifecycle', () => {
  type Handler = (...args: unknown[]) => void;
  let handlers: Record<string, Handler>;
  let socket: {
    on: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
    connect: jest.Mock;
    connected: boolean;
  };
  let authState: { logout: jest.Mock };
  let router: { navigate: jest.Mock };
  let service: SocialWebSocketService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const build = (
    apiBaseUrl = 'http://localhost:3000/api',
    platformId = 'browser'
  ) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return TestBed.inject(SocialWebSocketService);
  };

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    handlers = {};
    socket = {
      on: jest.fn((event: string, cb: Handler) => {
        handlers[event] = cb;
        return socket;
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn(),
      connected: false,
    };
    (io as jest.Mock).mockReturnValue(socket);
    authState = { logout: jest.fn() };
    router = { navigate: jest.fn() };
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = build();
    service.connect();
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    delete (window as Window & { env?: unknown }).env;
    TestBed.resetTestingModule();
  });

  describe('connect', () => {
    it('derives the socket url from the api base url host on port 3301', () => {
      expect(io).toHaveBeenCalledWith(
        'http://localhost:3301/social',
        expect.objectContaining({
          path: '/socket.io',
          transports: ['websocket', 'polling'],
        })
      );
    });

    it('is a no-op when the socket is already connected', () => {
      socket.connected = true;
      service.connect();
      expect(io).toHaveBeenCalledTimes(1);
    });

    it('resolves a relative api base url against the window origin', () => {
      TestBed.resetTestingModule();
      jest.clearAllMocks();
      (io as jest.Mock).mockReturnValue(socket);
      const relative = build('/api');
      relative.connect();
      expect(io).toHaveBeenCalledWith(
        'http://localhost:3301/social',
        expect.anything()
      );
    });

    it('does nothing on the server', () => {
      TestBed.resetTestingModule();
      jest.clearAllMocks();
      const server = build('http://localhost:3000/api', 'server');
      server.connect();
      expect(io).not.toHaveBeenCalled();
    });
  });

  describe('connection lifecycle events', () => {
    it('marks the service connected and resets the backoff counter', (done) => {
      service['reconnectAttempts'] = 3;
      handlers['connect']();
      expect(service['reconnectAttempts']).toBe(0);
      service.getConnectionStatus().subscribe((connected) => {
        expect(connected).toBe(true);
        done();
      });
    });

    it('does not retry after a deliberate client disconnect', () => {
      handlers['disconnect']('io client disconnect');
      expect(service['reconnectAttempts']).toBe(0);
    });

    it('retries after an unexpected disconnect', () => {
      jest.useFakeTimers();
      try {
        handlers['disconnect']('transport close');
        expect(service['reconnectAttempts']).toBe(1);
        jest.runOnlyPendingTimers();
        expect(socket.connect).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it.each(['unauthorized', 'jwt expired', 'bad token', 'Unauthorized'])(
      'logs out and redirects when connect fails with %s',
      (message) => {
        handlers['connect_error']({ message });
        expect(authState.logout).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
      }
    );

    it('retries instead of logging out for a non-auth connect error', (done) => {
      service.getConnectionError().subscribe((error) => {
        if (error) {
          expect(error).toBe('Connection error boom');
          done();
        }
      });
      handlers['connect_error']({ message: 'boom' });
      expect(authState.logout).not.toHaveBeenCalled();
      expect(service['reconnectAttempts']).toBe(1);
    });

    it('reports and retries a connection timeout', (done) => {
      service.getConnectionError().subscribe((error) => {
        if (error) {
          expect(error).toBe('Connection timed out');
          done();
        }
      });
      handlers['connect_timeout']();
      expect(service['reconnectAttempts']).toBe(1);
    });

    it('retries when reconnection fails', () => {
      handlers['reconnect_failed']();
      expect(service['reconnectAttempts']).toBe(1);
    });

    it.each([
      [{ type: 'UnauthorizedException' }],
      [{ message: 'Unauthorized request' }],
      [{ statusCode: 401 }],
    ])('logs out on an authorization socket error %j', (error) => {
      handlers['error'](error);
      expect(authState.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      expect(service['reconnectAttempts']).toBe(0);
    });

    it('retries for a non-authorization socket error object', () => {
      handlers['error']({ message: 'kaboom' });
      expect(authState.logout).not.toHaveBeenCalled();
      expect(service['reconnectAttempts']).toBe(1);
    });

    it('retries for a socket error that is not an object', () => {
      handlers['error']('kaboom');
      expect(service['reconnectAttempts']).toBe(1);
    });

    it('gives up after the maximum number of attempts', (done) => {
      service['reconnectAttempts'] = 5;
      service.getConnectionError().subscribe((error) => {
        if (error) {
          expect(error).toBe('Unable to reconnect after multiple attempts.');
          done();
        }
      });
      handlers['reconnect_failed']();
      expect(service['reconnectAttempts']).toBe(5);
    });
  });

  describe('post events', () => {
    const post = (id: string, content = 'a') => ({ id, content } as never);

    it('prepends a newly created post', () => {
      handlers['post_created'](post('1'));
      handlers['post_created'](post('2'));
      expect(service['posts$'].value.map((p) => p.id)).toEqual(['2', '1']);
    });

    it('ignores a duplicate created post', () => {
      handlers['post_created'](post('1'));
      handlers['post_created'](post('1'));
      expect(service['posts$'].value).toHaveLength(1);
    });

    it('replaces an updated post in place', () => {
      handlers['post_created'](post('1', 'old'));
      handlers['post_updated'](post('1', 'new'));
      expect(service['posts$'].value[0].content).toBe('new');
    });

    it('ignores an update for an unknown post', () => {
      handlers['post_created'](post('1'));
      handlers['post_updated'](post('999'));
      expect(service['posts$'].value.map((p) => p.id)).toEqual(['1']);
    });

    it('removes a deleted post', () => {
      handlers['post_created'](post('1'));
      handlers['post_deleted']({ postId: '1' });
      expect(service['posts$'].value).toEqual([]);
    });

    it('replaces the whole list on a feed response', () => {
      handlers['feed']([post('7')]);
      expect(service['posts$'].value.map((p) => p.id)).toEqual(['7']);
    });
  });

  describe('informational events', () => {
    it.each([
      'comment_created',
      'comment_updated',
      'comment_deleted',
      'vote_updated',
      'user_follow',
      'user_unfollow',
      'subscribed',
      'unsubscribed',
    ])('logs %s without changing state', (event) => {
      handlers[event]({ id: 'x' });
      expect(logSpy).toHaveBeenCalled();
      expect(service['posts$'].value).toEqual([]);
    });

    it('forwards typing indicators', (done) => {
      const payload = {
        conversationId: 'c1',
        userId: 'u1',
        isTyping: true,
      };
      service.onTypingIndicator().subscribe((data) => {
        expect(data).toEqual(payload);
        done();
      });
      handlers['typing'](payload);
    });
  });

  describe('outbound messages', () => {
    beforeEach(() => {
      socket.connected = true;
    });

    it('subscribes to posts', () => {
      service.subscribeToPosts('p1', ['1']);
      expect(socket.emit).toHaveBeenCalledWith('SUBSCRIBE_POSTS', {
        profileId: 'p1',
        postIds: ['1'],
      });
    });

    it('unsubscribes from posts', () => {
      service.unsubscribeFromPosts('p1');
      expect(socket.emit).toHaveBeenCalledWith('UNSUBSCRIBE_POSTS', {
        profileId: 'p1',
        postIds: undefined,
      });
    });

    it('subscribes to user activity', () => {
      service.subscribeToUserActivity('p1', ['u2']);
      expect(socket.emit).toHaveBeenCalledWith('SUBSCRIBE_USER_ACTIVITY', {
        profileId: 'p1',
        targetUserIds: ['u2'],
      });
    });

    it('unsubscribes from user activity', () => {
      service.unsubscribeFromUserActivity('p1', ['u2']);
      expect(socket.emit).toHaveBeenCalledWith('UNSUBSCRIBE_USER_ACTIVITY', {
        profileId: 'p1',
        targetUserIds: ['u2'],
      });
    });

    it('requests the feed with default paging', () => {
      service.getFeed('p1');
      expect(socket.emit).toHaveBeenCalledWith('GET_FEED', {
        profileId: 'p1',
        limit: 50,
        offset: 0,
      });
    });

    it('sends a typing indicator', () => {
      service.sendTypingIndicator('c1', true);
      expect(socket.emit).toHaveBeenCalledWith('typing', {
        conversationId: 'c1',
        isTyping: true,
      });
    });

    it('reports itself connected', () => {
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('when the socket is not connected', () => {
    it('emits nothing and warns where appropriate', () => {
      socket.connected = false;

      service.subscribeToPosts('p1');
      service.unsubscribeFromPosts('p1');
      service.subscribeToUserActivity('p1');
      service.unsubscribeFromUserActivity('p1');
      service.getFeed('p1');
      service.sendTypingIndicator('c1', false);

      expect(socket.emit).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Socket not connected. Call connect() first.'
      );
    });
  });

  it('disconnects and clears the socket', (done) => {
    service.disconnect();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(service.isConnected()).toBe(false);
    service.getConnectionStatus().subscribe((connected) => {
      expect(connected).toBe(false);
      done();
    });
  });

  it('disconnects and clears a pending retry on destroy', () => {
    jest.useFakeTimers();
    try {
      handlers['disconnect']('transport close');
      expect(service['reconnectTimeoutId']).not.toBeNull();
      service.ngOnDestroy();
      expect(socket.disconnect).toHaveBeenCalled();
      expect(service['reconnectTimeoutId']).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
