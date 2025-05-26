import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserComponent } from './user.component';
import { AuthStateService } from '../../state/auth-state.service';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('UserComponent', () => {
  let component: UserComponent;
  let fixture: ComponentFixture<UserComponent>;
  let authStateService: AuthStateService;
  let router: Router;

  const authStateServiceMock = {
    isAuthenticated$: of(false),
    decodedToken$: of(null),
    logout: jest.fn(),
  };

  const routerMock = {
    navigate: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserComponent, CommonModule, ButtonComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthStateService, useValue: authStateServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserComponent);
    component = fixture.componentInstance;
    authStateService = TestBed.inject(AuthStateService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set isLoggedIn and user on ngOnInit', () => {
    const userData = { name: 'Test User' };
    (authStateService.isAuthenticated$ as any) = of(true);
    (authStateService.decodedToken$ as any) = of(userData);

    component.ngOnInit();

    authStateService.isAuthenticated$.subscribe(() => {
      expect(component.isLoggedIn).toBe(true);
    });

    authStateService.decodedToken$.subscribe((user) => {
      expect(component.user).toEqual(userData);
    });
  });

  it('should call next and complete on destroy$', () => {
    component.ngOnDestroy();
    expect(component['destroy$'].isStopped).toBe(true);
  });

  it('should navigate to /login on login', () => {
    component.login();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should navigate to /register on register', () => {
    component.register();
    expect(router.navigate).toHaveBeenCalledWith(['/register']);
  });

});