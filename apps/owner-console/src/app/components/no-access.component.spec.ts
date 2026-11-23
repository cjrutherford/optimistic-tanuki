import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AuthService } from '../services/auth.service';
import { OwnerAccessService } from '../services/owner-access.service';
import { NoAccessComponent } from './no-access.component';

interface AuthStub {
  logout: jest.Mock;
}
interface AccessStub {
  reset: jest.Mock;
}

describe('NoAccessComponent', () => {
  it('explains the refusal and signs the user out', () => {
    const auth: AuthStub = { logout: jest.fn() };
    const access: AccessStub = { reset: jest.fn() };
    TestBed.configureTestingModule({
      imports: [NoAccessComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OwnerAccessService, useValue: access },
      ],
    });
    const fixture = TestBed.createComponent(NoAccessComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "You don't have access to the owner console"
    );
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    expect(access.reset).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });
});
