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
    expect(label.htmlFor).toBe('business-contact-subject');
    expect(select.id).toBe('business-contact-subject');
  });
});
