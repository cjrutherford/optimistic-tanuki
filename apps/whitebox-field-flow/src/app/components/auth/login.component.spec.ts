import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { LoginComponent } from './login.component';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { of } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: CustomerAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(CustomerAuthService);
    fixture.detectChanges();
  });

  it('should create and initialize login form', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm.valid).toBe(false);
  });

  it('requires the server-compatible password length', () => {
    component.loginForm.setValue({
      email: 'client@example.com',
      password: 'short12',
    });

    expect(component.loginForm.valid).toBe(false);
  });

  it('should submit login when valid', () => {
    const loginSpy = jest.spyOn(authService, 'login').mockReturnValue(
      of({
        success: true,
        user: { email: 'client@example.com', name: 'Client' },
      })
    );

    component.loginForm.setValue({
      email: 'client@example.com',
      password: 'password123',
    });
    expect(component.loginForm.valid).toBe(true);

    component.onSubmit();
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'client@example.com',
      password: 'password123',
    });
  });
});
