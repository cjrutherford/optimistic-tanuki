import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { CONTACT_SUBJECTS } from '../content/site-content';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { ContactRequestService } from '../services/contact-request.service';
import { CustomSoftwarePageComponent } from './custom-software/custom-software-page.component';
import { PartnersPageComponent } from './partners/partners-page.component';
import { HowWeWorkPageComponent } from './how-we-work/how-we-work-page.component';
import { ContactPageComponent } from './contact/contact-page.component';

interface ContactRequestStub {
  submit: jest.Mock;
}

function configure(providers: unknown[] = []) {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [provideRouter([]), ...(providers as never[])],
  });
}

function render<T>(component: Type<T>) {
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

describe('offering pages', () => {
  it.each([
    [CustomSoftwarePageComponent, 'Custom software', ['#services']],
    [PartnersPageComponent, 'Partners', ['#partners']],
    [HowWeWorkPageComponent, 'How we work', ['#approach', '#engagement']],
    [ContactPageComponent, "Tell us what you're trying to do.", ['#contact']],
  ] as const)(
    '%p has one h1 and hosts its existing section',
    (component, heading, selectors) => {
      configure();
      const element = render(component as Type<unknown>)
        .nativeElement as HTMLElement;

      expect(element.querySelectorAll('h1')).toHaveLength(1);
      expect(element.querySelector('h1')?.textContent?.trim()).toBe(heading);
      for (const selector of selectors) {
        expect(element.querySelector(selector)).not.toBeNull();
      }
    }
  );

  it('contact page shows a carried-over message and submits from /contact', () => {
    configure();
    const contact = TestBed.inject(ContactRequestService);
    const submit = jest
      .spyOn(contact, 'submit')
      .mockImplementation(() => undefined);
    contact.setPrefill('Please send me the comparison');
    const fixture = render(ContactPageComponent);
    const form = fixture.debugElement.query(By.directive(ContactFormComponent))
      .componentInstance as ContactFormComponent;

    expect(form.contactForm.value.message).toBe(
      'Please send me the comparison'
    );

    const request = {
      name: 'Ada',
      email: 'ada@example.com',
      subject: 'infrastructure',
      message: 'Hello',
    };
    fixture.componentInstance.submit(request);

    expect(submit).toHaveBeenCalledWith(request, '/contact');
  });

  describe('contact page subject handoff', () => {
    function renderWithSubject(subject: string | null) {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: of(
                convertToParamMap(subject === null ? {} : { subject })
              ),
            },
          },
        ],
      });
      const fixture = render(ContactPageComponent);
      return fixture.debugElement.query(By.directive(ContactFormComponent))
        .componentInstance as ContactFormComponent;
    }

    it('preselects the subject named by ?subject=', () => {
      const form = renderWithSubject('technical-support');

      expect(form.contactForm.value.subject).toBe('technical-support');
    });

    it('ignores an unknown ?subject= value', () => {
      const form = renderWithSubject('not-a-subject');

      expect(form.contactForm.value.subject).toBe('');
    });

    it('preselects nothing without a ?subject= value', () => {
      const form = renderWithSubject(null);

      expect(form.contactForm.value.subject).toBe('');
    });
  });

  describe('contact subjects', () => {
    const values = CONTACT_SUBJECTS.map((subject) => subject.value);

    it('keeps the existing subject values', () => {
      expect(values).toEqual(
        expect.arrayContaining([
          'custom-portal',
          'infrastructure',
          'tailored-software',
          'partner-inquiry',
        ])
      );
    });

    it('adds training, technical support and a general subject', () => {
      expect(values).toEqual(
        expect.arrayContaining(['training', 'technical-support', 'other'])
      );
    });

    it('has no duplicate values', () => {
      expect(new Set(values).size).toBe(values.length);
    });
  });
});
