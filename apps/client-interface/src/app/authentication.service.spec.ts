import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthenticationService } from './authentication.service';
import { RegisterRequest } from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthenticationService,
        { provide: API_BASE_URL, useValue: '' },
      ],
    });
    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have isAuthenticated as false initially', () => {
    service.isAuthenticated.subscribe((value) => {
      expect(value).toBeFalsy();
    });
  });

  it('should have userData as null initially', () => {
    service.userData.subscribe((value) => {
      expect(value).toBeNull();
    });
  });

  it('should register a user', () => {
    const mockRegisterRequest: RegisterRequest = {
      fn: 'test',
      ln: 'user',
      password: 'password',
      confirm: 'password',
      email: 'test@user.com',
      bio: '',
    };
    service.register(mockRegisterRequest).subscribe();

    const req = httpMock.expectOne('/authentication/register');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('exposes isAuthenticated as an observable', async () => {
    const values: boolean[] = [];
    service.isAuthenticated$().subscribe((v) => values.push(v));
    expect(values).toEqual([false]);
  });

  it('logs in with cookie session mode and credentials', async () => {
    const promise = service.login({
      email: 'test@user.com',
      password: 'pw',
    } as never);

    const req = httpMock.expectOne('/authentication/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: {} });

    await expect(promise).resolves.toEqual({ data: {} });
  });

  it('reads the current session with credentials', async () => {
    const promise = service.currentSession();

    const req = httpMock.expectOne('/authentication/session');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { id: 'u1' } });

    await expect(promise).resolves.toEqual({ data: { id: 'u1' } });
  });

  describe('setToken', () => {
    const makeToken = (payload: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;

    it('decodes the payload and marks the user authenticated', () => {
      const payload = { userId: 'u1', exp: Math.floor(Date.now() / 1000) + 60 };

      service.setToken(makeToken(payload));

      expect(service.isAuthenticated.value).toBe(true);
      expect(service.userData.value).toEqual(payload);
    });

    it('clears the session once the token expiry elapses', () => {
      jest.useFakeTimers();
      try {
        const payload = {
          userId: 'u1',
          exp: Math.floor(Date.now() / 1000) + 60,
        };
        service.setToken(makeToken(payload));

        jest.advanceTimersByTime(60_000);

        expect(service.isAuthenticated.value).toBe(false);
        expect(service.userData.value).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
