import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;
  let router: Router;
  let authStateService: AuthStateService;

  const authStateServiceMock = {
    isAuthenticated$: jest.fn()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        AuthenticationGuard,
        { provide: AuthStateService, useValue: authStateServiceMock }
      ]
    });
    guard = TestBed.inject(AuthenticationGuard);
    router = TestBed.inject(Router);
    authStateService = TestBed.inject(AuthStateService);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true and not navigate for an authenticated user', (done) => {
    authStateServiceMock.isAuthenticated$.mockReturnValue(of(true));
    const navigateSpy = jest.spyOn(router, 'navigate');

    guard.canActivate().subscribe(result => {
      expect(result).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
      done();
    });
  });

  it('should return false and navigate to /login for an unauthenticated user', (done) => {
    authStateServiceMock.isAuthenticated$.mockReturnValue(of(false));
    const navigateSpy = jest.spyOn(router, 'navigate');

    guard.canActivate().subscribe(result => {
      expect(result).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
      done();
    });
  });
});