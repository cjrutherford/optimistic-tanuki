import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { BusinessLoginPageComponent } from './business-login-page.component';

describe('BusinessLoginPageComponent', () => {
  it('renders owner login copy and navigates to the owner dashboard after login', () => {
    const navigate = jest.fn();
    const loginAndExchange = jest.fn().mockReturnValue(of({}));

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: Router,
          useValue: { navigate },
        },
      ],
    });

    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.componentInstance.email = 'owner@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Owner Login');
    expect(text).toContain('owner workspace');
    expect(text).not.toContain('Trainer Login');
    expect(fixture.nativeElement.textContent).not.toContain('trainer workspace');
    expect(fixture.nativeElement.querySelector('input[type="email"]').placeholder).toBe(
      'owner@example.com'
    );

    fixture.componentInstance.onSubmit();

    expect(loginAndExchange).toHaveBeenCalledWith('owner@example.com', 'secret');
    expect(navigate).toHaveBeenCalledWith(['/owner/dashboard']);
  });
});
