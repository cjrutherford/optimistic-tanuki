import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactBubbleComponent } from './contact-bubble.component';

describe('ContactBubbleComponent', () => {
  let component: ContactBubbleComponent;
  let fixture: ComponentFixture<ContactBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactBubbleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
