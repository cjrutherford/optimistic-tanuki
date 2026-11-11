import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactFormComponent } from './contact-form.component';

describe('ContactFormComponent', () => {
  let component: ContactFormComponent;
  let fixture: ComponentFixture<ContactFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills the message when initialMessage is set', () => {
    component.initialMessage = 'Please send me the comparison.';
    fixture.detectChanges();

    expect(component.contactForm.value.message).toBe(
      'Please send me the comparison.'
    );
  });

  it('shows a prefilled message in the message box', () => {
    component.initialMessage = 'Please send me the comparison.';
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe('Please send me the comparison.');
  });

  it('keeps edits the visitor makes to a prefilled message', () => {
    component.initialMessage = 'Please send me the comparison.';
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;

    textarea.value = 'Please send me the comparison. We have 12 staff.';
    textarea.dispatchEvent(new Event('input'));

    expect(component.contactForm.value.message).toBe(
      'Please send me the comparison. We have 12 staff.'
    );
  });

  it('ignores empty prefill messages', () => {
    component.initialMessage = '';
    fixture.detectChanges();

    expect(component.contactForm.value.message).toBe('');
  });

  it('associates the subject label with the select control', () => {
    component.subjects = [{ value: 'question', label: 'Question' }];
    component.subjectId = 'business-contact-subject';
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector(
      '.contact-subject-label'
    ) as HTMLLabelElement;
    const select = fixture.nativeElement.querySelector(
      'select'
    ) as HTMLSelectElement;

    expect(label.textContent.trim()).toBe('Subject');
    expect(label.htmlFor).toBe('business-contact-subject-control');
    expect(select.id).toBe('business-contact-subject-control');
  });

  describe('initialSubject', () => {
    const subjects = [
      { value: 'training', label: 'Training or a class' },
      { value: 'technical-support', label: 'Technical support' },
    ];

    it('leaves the subject empty by default', () => {
      fixture.componentRef.setInput('subjects', subjects);
      fixture.detectChanges();

      expect(component.contactForm.value.subject).toBe('');
    });

    it('preselects a value that matches a provided subject', async () => {
      fixture.componentRef.setInput('subjects', subjects);
      fixture.componentRef.setInput('initialSubject', 'technical-support');
      fixture.detectChanges();
      await fixture.whenStable();
      const select = fixture.nativeElement.querySelector(
        'select'
      ) as HTMLSelectElement;

      expect(component.contactForm.value.subject).toBe('technical-support');
      expect(select.value).toBe('technical-support');
    });

    it('preselects when the subjects arrive after the initial subject', () => {
      fixture.componentRef.setInput('initialSubject', 'training');
      fixture.componentRef.setInput('subjects', subjects);
      fixture.detectChanges();

      expect(component.contactForm.value.subject).toBe('training');
    });

    it('ignores a value that matches no provided subject', () => {
      fixture.componentRef.setInput('subjects', subjects);
      fixture.componentRef.setInput('initialSubject', 'not-a-subject');
      fixture.detectChanges();

      expect(component.contactForm.value.subject).toBe('');
    });

    it('submits the chosen subject, preselected or changed by the visitor', async () => {
      fixture.componentRef.setInput('subjects', subjects);
      fixture.componentRef.setInput('initialSubject', 'training');
      fixture.detectChanges();
      await fixture.whenStable();
      const emitted: unknown[] = [];
      component.formSubmit.subscribe((value) => emitted.push(value));
      const select = fixture.nativeElement.querySelector(
        'select'
      ) as HTMLSelectElement;

      component.onSubscribe();
      select.value = 'technical-support';
      select.dispatchEvent(new Event('change'));
      component.onSubscribe();

      expect(emitted).toEqual([
        expect.objectContaining({ subject: 'training' }),
        expect.objectContaining({ subject: 'technical-support' }),
      ]);
    });
  });

  it('shows no banner image unless one is supplied', () => {
    expect(component.bannerImage).toBeNull();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('shows a supplied banner with its alt text, decorative by default', () => {
    component.bannerImage = 'assets/contact.webp';
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector(
      'img'
    ) as HTMLImageElement;

    expect(image.getAttribute('src')).toBe('assets/contact.webp');
    expect(image.getAttribute('alt')).toBe('');

    component.bannerAlt = 'A small office server on a shelf';
    fixture.detectChanges();
    expect(image.getAttribute('alt')).toBe('A small office server on a shelf');
  });
});
