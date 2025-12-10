import { TestBed } from '@angular/core/testing';
import { SocialWebSocketService } from './social-websocket.service';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

describe('SocialWebSocketService', () => {
  let service: SocialWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: API_BASE_URL,
          useValue: 'http://localhost:3000/api',
        },
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
