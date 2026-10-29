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
