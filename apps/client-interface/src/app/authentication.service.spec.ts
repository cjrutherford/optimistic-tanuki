import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthenticationService } from './authentication.service';
import { RegisterRequest } from '@optimistic-tanuki/libs/models';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthenticationService]
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
    service.isAuthenticated.subscribe(value => {
      expect(value).toBeFalsy();
    });
  });

  it('should have userData as null initially', () => {
    service.userData.subscribe(value => {
      expect(value).toBeNull();
    });
  });

  it('should register a user', () => {
    const mockRegisterRequest: RegisterRequest = { fn: 'test', ln: 'user', password: 'password', confirm: 'password', email: "test@user.com", bio: '' };
    service.register(mockRegisterRequest).subscribe();

    const req = httpMock.expectOne('/api/authentication/register');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});