import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';
import { ANALYTICS_TRANSPORT } from '../../services/analytics.service';
import { AssessmentFormComponent } from './assessment-form.component';
import {
  AssessmentRequestService,
  AssessmentState,
} from '../../services/assessment-request.service';

interface AssessmentRequestStub {
  state: ReturnType<typeof signal<AssessmentState>>;
  submit: jest.Mock;
}

describe('AssessmentFormComponent', () => {
  let fixture: ComponentFixture<AssessmentFormComponent>;
  let element: HTMLElement;
  let request: AssessmentRequestStub;

  const set = (id: string, value: string) => {
    const field = element.querySelector(`#${id}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(
      new Event(field.tagName === 'SELECT' ? 'change' : 'input')
    );
  };
  const click = (id: string) =>
    (element.querySelector(`#${id}`) as HTMLInputElement).click();
  const submit = () => {
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
    fixture.detectChanges();
  };
  const fillValid = () => {
    click('assessment-audience-organization');
    fixture.detectChanges();
    set('assessment-organization', 'Grace Community');
    set('assessment-name', 'Ada Lovelace');
    set('assessment-email', 'ada@example.com');
    set('assessment-people', '6-20');
    click('assessment-keep-files');
    click('assessment-storage-not-sure');
    fixture.detectChanges();
  };

  beforeEach(() => {
    request = { state: signal<AssessmentState>('idle'), submit: jest.fn() };
    TestBed.configureTestingModule({
      imports: [AssessmentFormComponent],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(AssessmentFormComponent, {
      set: {
        providers: [{ provide: AssessmentRequestService, useValue: request }],
      },
    });
    fixture = TestBed.createComponent(AssessmentFormComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('labels every field', () => {
    for (const control of Array.from(
      element.querySelectorAll(
        'input:not([type="radio"]):not([type="checkbox"]), select, textarea'
      )
    )) {
      expect(
        element.querySelector(`label[for="${control.id}"]`)
      ).not.toBeNull();
    }
    for (const group of Array.from(element.querySelectorAll('fieldset'))) {
      expect(group.querySelector('legend')).not.toBeNull();
    }
  });

  it('groups each set of radio buttons for keyboard users', () => {
    const names = (prefix: string) =>
      Array.from(
        element.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][id^="${prefix}"]`
        )
      ).map((radio) => radio.name);

    expect(new Set(names('assessment-audience-'))).toEqual(
      new Set(['audience'])
    );
    expect(new Set(names('assessment-storage-'))).toEqual(new Set(['storage']));
  });

  it('shows an error summary and marks invalid fields when required answers are missing', () => {
    submit();

    const summary = element.querySelector('.error-summary');
    expect(summary?.getAttribute('role')).toBe('alert');
    expect(summary?.textContent).toContain('Choose home or organization.');
    expect(summary?.textContent).toContain('Enter your name');
    expect(summary?.textContent).toContain('Enter an email address');
    expect(
      element.querySelector('#assessment-email')?.getAttribute('aria-invalid')
    ).toBe('true');
    expect(
      element
        .querySelector('#assessment-email')
        ?.getAttribute('aria-describedby')
    ).toBe('assessment-email-error');
    expect(request.submit).not.toHaveBeenCalled();
  });

  it('rejects a malformed email and phone', () => {
    fillValid();
    set('assessment-email', 'not-an-email');
    set('assessment-phone', 'call me maybe');
    submit();

    expect(element.querySelector('.error-summary')?.textContent).toContain(
      'Enter an email address'
    );
    expect(element.querySelector('.error-summary')?.textContent).toContain(
      'Enter a phone number'
    );
    expect(request.submit).not.toHaveBeenCalled();
  });

  it('asks for an organization name only for organizations', () => {
    expect(element.querySelector('#assessment-organization')).toBeNull();
    click('assessment-audience-organization');
    fixture.detectChanges();

    expect(element.querySelector('#assessment-organization')).not.toBeNull();
  });

  it('submits valid answers with the empty spam trap', () => {
    fillValid();
    submit();

    expect(element.querySelector('.error-summary')).toBeNull();
    expect(request.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'organization',
        organization: 'Grace Community',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        people: '6-20',
        keep: ['files'],
        storage: 'not-sure',
      }),
      ''
    );
  });

  it('hides the spam trap from people and assistive technology', () => {
    const trap = element.querySelector('.trap');

    expect(trap?.getAttribute('aria-hidden')).toBe('true');
    expect(trap?.querySelector('input')?.getAttribute('tabindex')).toBe('-1');
  });

  it('disables the button while sending', () => {
    request.state.set('sending');
    fixture.detectChanges();
    const button = element.querySelector('.submit') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Sending…');
  });

  it('replaces the form with a confirmation once sent', () => {
    request.state.set('sent');
    fixture.detectChanges();

    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('#assessment-sent')?.textContent).toContain(
      'We have your answers'
    );
  });

  it('keeps the answers and offers phone and email when sending fails', () => {
    fillValid();
    request.state.set('failed');
    fixture.detectChanges();
    const failure = element.querySelector('.result.failure');

    expect(failure?.getAttribute('role')).toBe('alert');
    expect(failure?.textContent).toContain('could not send your answers');
    expect(
      Array.from(failure?.querySelectorAll('a') ?? []).map((link) =>
        link.getAttribute('href')
      )
    ).toEqual([
      'tel:+19125217314',
      'mailto:chris@hopefulaspirationsindustries.com',
    ]);
    expect(
      (element.querySelector('#assessment-name') as HTMLInputElement).value
    ).toBe('Ada Lovelace');
  });
});

describe('AssessmentFormComponent revisits', () => {
  interface BloggingApiStub {
    contactControllerCreateContact: jest.Mock;
  }

  it('shows a fresh form when the page is opened again after sending', () => {
    const api: BloggingApiStub = {
      contactControllerCreateContact: jest.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      imports: [AssessmentFormComponent],
      providers: [
        provideRouter([]),
        { provide: OptomisitcTanukiAPIService, useValue: api },
        { provide: ANALYTICS_TRANSPORT, useValue: () => undefined },
      ],
    });

    const first = TestBed.createComponent(AssessmentFormComponent);
    first.detectChanges();
    first.componentInstance.request.state.set('sent');
    first.detectChanges();
    expect(
      first.nativeElement.querySelector('#assessment-sent')
    ).not.toBeNull();
    // Navigating away destroys the form, and its request state with it.
    first.destroy();

    const second = TestBed.createComponent(AssessmentFormComponent);
    second.detectChanges();

    expect(second.componentInstance.request.state()).toBe('idle');
    expect(second.nativeElement.querySelector('form')).not.toBeNull();
    expect(second.nativeElement.querySelector('#assessment-sent')).toBeNull();
  });
});
