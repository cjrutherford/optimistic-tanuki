import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactComponent } from './contact.component';
import { CommonModule } from '@angular/common';

describe('ContactComponent', () => {
  let component: ContactComponent;
  let fixture: ComponentFixture<ContactComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ContactComponent', () => {
    let component: ContactComponent;
    let fixture: ComponentFixture<ContactComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CommonModule],
        declarations: [ContactComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(ContactComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have subjects array', () => {
      expect(component.subjects).toEqual([
        { value: 'general', label: 'General Inquiry' },
        { value: 'support', label: 'Support' },
        { value: 'feedback', label: 'Feedback' },
        { value: 'other', label: 'Other' }
      ]);
    });

    it('should call onContactFormSubmit when form is submitted', () => {
      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      submitButton.click();
      expect(component.onContactFormSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
