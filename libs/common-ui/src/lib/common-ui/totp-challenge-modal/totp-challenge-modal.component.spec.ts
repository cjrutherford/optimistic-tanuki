import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TotpChallengeModalComponent } from './totp-challenge-modal.component';

describe('TotpChallengeModalComponent', () => {
  let component: TotpChallengeModalComponent;
  let fixture: ComponentFixture<TotpChallengeModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TotpChallengeModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TotpChallengeModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    fixture.detectChanges();
  });

  it('creates component and renders title and security notice', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('.totp-modal-title');
    expect(title.textContent).toContain('Escrow Wire Shield Verification');
    const notice = fixture.nativeElement.querySelector('.totp-modal-subtitle');
    expect(notice.textContent).toContain('ALTA Pillar 3 Wire Fraud Defense');
  });

  it('renders 6 digit inputs', () => {
    const inputs = fixture.nativeElement.querySelectorAll('.digit-input');
    expect(inputs.length).toBe(6);
  });

  it('emits otpSubmitted when code is complete and submit is triggered', (done) => {
    component.digits = ['1', '2', '3', '4', '5', '6'];
    component.otpSubmitted.subscribe((code) => {
      expect(code).toBe('123456');
      done();
    });

    component.submitCode();
  });

  it('exposes dialog semantics for assistive technology', () => {
    component.isOpen = true;
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('totp-modal-title');
    expect(
      fixture.nativeElement.querySelector('#totp-modal-title')
    ).toBeTruthy();
  });

  it('labels each digit input and the group', () => {
    component.isOpen = true;
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      '[role="group"][aria-label="Six digit verification code"]'
    );
    expect(group).toBeTruthy();
    const inputs = fixture.nativeElement.querySelectorAll('.digit-input');
    expect(inputs.length).toBe(6);
    inputs.forEach((input: HTMLElement, index: number) => {
      expect(input.getAttribute('aria-label')).toBe(`Digit ${index + 1} of 6`);
    });
  });

  it('announces countdown changes through a live region', () => {
    component.isOpen = true;
    component.remainingSeconds = 42;
    fixture.detectChanges();

    const timer = fixture.nativeElement.querySelector(
      '.timer-label[aria-live="polite"]'
    );
    expect(timer).toBeTruthy();
    expect(timer.textContent).toContain('42s');
  });

  it('closes on Escape', () => {
    component.isOpen = true;
    fixture.detectChanges();
    const closed = jest.fn();
    component.modalClosed.subscribe(closed);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    expect(closed).toHaveBeenCalled();
  });

  it('restores focus to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    component.isOpen = true;
    fixture.detectChanges();
    component.isOpen = false;
    fixture.detectChanges();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('handles paste of 6-digit numeric string', () => {
    const clipboardData = {
      getData: () => '918273',
    };
    const pasteEvent = {
      preventDefault: () => {},
      clipboardData,
    } as unknown as ClipboardEvent;

    component.onPaste(pasteEvent);
    expect(component.digits).toEqual(['9', '1', '8', '2', '7', '3']);
    expect(component.isCodeComplete()).toBe(true);
  });
});
