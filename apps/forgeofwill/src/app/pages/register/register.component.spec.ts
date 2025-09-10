import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { AuthenticationService } from '../../authentication.service';
import { Router } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { of, throwError } from 'rxjs';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthenticationService;
  let router: Router;
  let messageService: MessageService;

  beforeEach(async () => {
    const authServiceMock = {
      register: jest.fn().mockReturnValue(of({})),
    };
    const routerMock = {
      navigate: jest.fn(),
    };
    const messageServiceMock = {
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthenticationService);
    router = TestBed.inject(Router);
    messageService = TestBed.inject(MessageService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onSubmit', () => {
    const registerData: RegisterSubmitType = { email: 'test@example.com', password: 'password', confirmation: 'password', firstName: 'Test', lastName: 'User' };

    it('should handle successful registration', fakeAsync(() => {
      component.onSubmit(registerData);
      tick();

      expect(authService.register).toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Registration successful!',
        type: 'success',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    }));

    it('should handle registration failure', fakeAsync(() => {
      jest.spyOn(authService, 'register').mockReturnValue(throwError(() => new Error('Registration failed')));

      component.onSubmit(registerData);
      tick();

      expect(authService.register).toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Registration failed: Registration failed',
        type: 'error',
      });
      expect(router.navigate).not.toHaveBeenCalled();
    }));
  });
});
