import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
    [ContactPageComponent, 'Contact', ['#contact']],
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
});
