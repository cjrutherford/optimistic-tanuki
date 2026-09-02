import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectInviteFormComponent } from './invite-form.component';

/**
 * Whether the form actually stops a wasted round trip, not just whether the
 * class would. Bindings that never render have broken this codebase before.
 */
describe('ProjectInviteFormComponent', () => {
  let fixture: ComponentFixture<ProjectInviteFormComponent>;
  let component: ProjectInviteFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectInviteFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectInviteFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function typeEmail(value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="email"]'
    );
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[type="submit"]');
  }

  it('refuses to submit a blank address', () => {
    const invited: string[] = [];
    component.invited.subscribe((email) => invited.push(email));

    expect(submitButton().disabled).toBe(true);

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(invited).toEqual([]);
  });

  it('refuses an address that is only whitespace', () => {
    typeEmail('   ');

    expect(submitButton().disabled).toBe(true);
  });

  it('emits the trimmed address a person typed', () => {
    const invited: string[] = [];
    component.invited.subscribe((email) => invited.push(email));

    typeEmail('  someone@example.com  ');
    submitButton().click();

    expect(invited).toEqual(['someone@example.com']);
  });

  it('clears the field once the address has been sent', () => {
    typeEmail('someone@example.com');
    submitButton().click();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="email"]'
    );
    expect(input.value).toBe('');
  });

  it('disables the field and the button while busy, and says so', () => {
    component.busy = true;
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="email"]'
    );
    expect(input.disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Sending');
  });

  it('shows an error passed in from the caller', () => {
    component.error = 'That address already has an invite.';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'That address already has an invite.'
    );
  });

  it('shows no error text when there is none', () => {
    expect(fixture.nativeElement.textContent).not.toContain('undefined');
    expect(fixture.nativeElement.querySelector('.error')).toBeNull();
  });
});
