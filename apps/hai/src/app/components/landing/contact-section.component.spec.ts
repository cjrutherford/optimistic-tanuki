import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { ContactSectionComponent } from './contact-section.component';

describe('ContactSectionComponent', () => {
  let fixture: ComponentFixture<ContactSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactSectionComponent);
    fixture.componentRef.setInput('contactLead', {
      title: 'Build with HAI',
      description: 'Let us start a conversation.',
    });
    fixture.componentRef.setInput('contactSubjects', [
      { value: 'strategy', label: 'Strategy' },
    ]);
    fixture.componentRef.setInput('contactStatus', 'Message sent');
    fixture.detectChanges();
  });

  it('renders the canonical brand surface contract on the section shell', () => {
    const section = fixture.nativeElement.querySelector('section');

    expect(section?.getAttribute('data-tone')).toBe('brand');
    expect(section?.getAttribute('data-emphasis')).toBe('soft');
    expect(section?.getAttribute('data-size')).toBe('lg');
    expect(section?.id).toBe('contact');
    expect(
      section?.querySelector('lib-contact-form > otui-card')
    ).not.toBeNull();
  });

  it('renders the configured contact lead copy', () => {
    expect(
      fixture.nativeElement.querySelector('.eyebrow')?.textContent
    ).toContain('Build with HAI');
    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Let us start a conversation.'
    );
  });

  it('preserves contact form presence and input wiring', () => {
    const formDebugElement = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    const form = formDebugElement.componentInstance as ContactFormComponent;

    expect(formDebugElement).not.toBeNull();
    expect(form.title).toBe('Start a project with HAI');
    expect(form.buttonText).toBe('Send Message');
    expect(form.subjects).toEqual([{ value: 'strategy', label: 'Strategy' }]);
  });

  it('passes the sending button text while contact submission is in progress', () => {
    fixture.componentRef.setInput('submittingContact', true);
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.directive(ContactFormComponent))
      .componentInstance as ContactFormComponent;

    expect(form.buttonText).toBe('Sending…');
  });

  it('does not render contact status when it is null', () => {
    fixture.componentRef.setInput('contactStatus', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.contact-status')).toBeNull();
  });

  it('renders contact status as a polite live region', () => {
    const status = fixture.nativeElement.querySelector('.contact-status');

    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toContain('Message sent');
  });

  it('forwards the contact form submit event', () => {
    const payload = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'strategy',
      message: 'Let us work together.',
    };
    const submitSpy = jest.spyOn(fixture.componentInstance.formSubmit, 'emit');
    const form = fixture.debugElement.query(By.directive(ContactFormComponent))
      .componentInstance as ContactFormComponent;

    form.formSubmit.emit(payload);

    expect(submitSpy).toHaveBeenCalledWith(payload);
  });
});
