import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SocialWebSocketService } from './social-websocket.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './state/auth-state.service';
import { PLATFORM_ID } from '@angular/core';
import { io } from 'socket.io-client';

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
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    service['reconnectWithBackoff']();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.runAllTimers();
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
      expect.objectContaining({ path: '/ws' })
    );

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
    service['reconnectTimeoutId'] = setTimeout(() => {}, 1000);
    service.ngOnDestroy();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
