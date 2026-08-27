import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonalityBackdropComponent } from './personality-backdrop.component';

describe('PersonalityBackdropComponent', () => {
  let component: PersonalityBackdropComponent;
  let fixture: ComponentFixture<PersonalityBackdropComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalityBackdropComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalityBackdropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders as a non-interactive host element with no template content', () => {
    // Empty template — the host element itself is the backdrop layer
    // (styled entirely via personality-backdrop.component.scss).
    expect(fixture.nativeElement.innerHTML).toBe('');
  });
});
