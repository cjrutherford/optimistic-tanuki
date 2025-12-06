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
});
