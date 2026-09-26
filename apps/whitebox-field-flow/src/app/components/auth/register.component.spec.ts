import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RegisterComponent } from './register.component';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { of } from 'rxjs';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: CustomerAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(CustomerAuthService);
    fixture.detectChanges();
  });

  it('should create and initialize register form', () => {
    expect(component).toBeTruthy();
    expect(component.registerForm.valid).toBe(false);
  });

  it('requires a first and last name for the registration contract', () => {
    component.registerForm.setValue({
      name: 'John',
      email: 'client@example.com',
      password: 'password123',
    });

    expect(component.registerForm.valid).toBe(false);
  });

  it('requires the server-compatible password length', () => {
    component.registerForm.setValue({
      name: 'John Miller',
      email: 'client@example.com',
      password: 'short',
    });

    expect(component.registerForm.valid).toBe(false);
  });

  it('keeps the user informed when email verification is required', () => {
    jest
      .spyOn(authService, 'register')
      .mockReturnValue(
        of({ success: true, user: null, verificationRequired: true })
      );

    component.registerForm.setValue({
      name: 'John Miller',
      email: 'client@example.com',
      password: 'password123',
    });
    component.onSubmit();

    expect(component.statusMessage).toContain('verify');
  });

  it('should submit registration when form is valid', () => {
    const registerSpy = jest.spyOn(authService, 'register').mockReturnValue(
      of({
        success: true,
        user: { email: 'client@example.com', name: 'John Miller' },
        verificationRequired: false,
      })
    );

    component.registerForm.setValue({
      name: 'John Miller',
      email: 'client@example.com',
      password: 'password123',
    });
    expect(component.registerForm.valid).toBe(true);

    component.onSubmit();
    expect(registerSpy).toHaveBeenCalledWith({
      name: 'John Miller',
      email: 'client@example.com',
      password: 'password123',
    });
  });
});
