import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewsletterSignupComponent } from './newsletter-signup.component';

describe('NewsletterSignupComponent', () => {
  let component: NewsletterSignupComponent;
  let fixture: ComponentFixture<NewsletterSignupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsletterSignupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsletterSignupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default bannerImage value', () => {
    expect(component.bannerImage).toBe('https://picsum.photos/1200/300');
  });

  it('should open modal when openModal is called', () => {
    component.isModalOpen = false;
    component.openModal();
    expect(component.isModalOpen).toBeTruthy();
  });

  it('should close modal when closeModal is called', () => {
    component.isModalOpen = true;
    component.closeModal();
    expect(component.isModalOpen).toBeFalsy();
  });

  it('should emit signUp event and reset email on submit when email is set', () => {
    spyOn(component.signUp, 'emit');
    component.email = 'test@example.com';
    component.isModalOpen = true;
    component.submit();
    expect(component.signUp.emit).toHaveBeenCalledWith('test@example.com');
    expect(component.email).toBe('');
    expect(component.isModalOpen).toBeFalsy();
  });

  it('should not emit signUp event or reset modal/email if email is empty', () => {
    spyOn(component.signUp, 'emit');
    component.email = '';
    component.isModalOpen = true;
    component.submit();
    expect(component.signUp.emit).not.toHaveBeenCalled();
    expect(component.email).toBe('');
    expect(component.isModalOpen).toBeTruthy();
  });
});
