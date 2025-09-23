import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpEventType, HttpResponse, HTTP_INTERCEPTORS, HttpClient, HttpClientModule, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, HttpClientTestingModule } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { authenticationInterceptor } from './authentication.interceptor';
import { AuthStateService } from './auth-state.service';

describe('authenticationInterceptor', () => {
  let httpMock: HttpTestingController;
  let authStateService: AuthStateService;
  let router: Router;
  let httpClient: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, HttpClientModule],
      providers: [
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: { getToken: jest.fn(), logout: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    authStateService = TestBed.inject(AuthStateService);
    router = TestBed.inject(Router);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add an Authorization header if a token is present', fakeAsync(() => {
    jest.spyOn(authStateService, 'getToken').mockReturnValue('test-token');

    httpClient.get('/api/data').subscribe();

    const testReq = httpMock.expectOne('/api/data');
    expect(testReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    testReq.flush({});
    tick();
  }));

  it('should not add an Authorization header if no token is present', fakeAsync(() => {
    jest.spyOn(authStateService, 'getToken').mockReturnValue(null);

    httpClient.get('/api/data').subscribe();

    const testReq = httpMock.expectOne('/api/data');
    expect(testReq.request.headers.get('Authorization')).toBe('Bearer null');
    testReq.flush({});
    tick();
  }));

  it('should handle 401 errors by logging out and navigating to login', fakeAsync(() => {
    jest.spyOn(authStateService, 'getToken').mockReturnValue('test-token');

    httpClient.get('/api/data').subscribe({
      error: (error) => {
        expect(error.status).toBe(401);
        expect(authStateService.logout).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
      },
    });

    const testReq = httpMock.expectOne('/api/data');
    testReq.error(new ErrorEvent('Unauthorized'), { status: 401 });
    tick();
  }));

  it('should rethrow other errors', fakeAsync(() => {
    jest.spyOn(authStateService, 'getToken').mockReturnValue('test-token');

    httpClient.get('/api/data').subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
        expect(error.message).toBe('Server Error');
        expect(authStateService.logout).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
      },
    });

    const testReq = httpMock.expectOne('/api/data');
    testReq.error(new ErrorEvent('Server Error'), { status: 500, statusText: 'Server Error' });
    tick();
  }));
});
