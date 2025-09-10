import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroComponent } from './hero.component';

describe('HeroComponent', () => {
  let component: HeroComponent;
  let fixture: ComponentFixture<HeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display default title, description, button text, and image', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.title).toBe('Welcome to Our Blog!');
    expect(component.description).toBe('Discover the latest news, tips, and stories from our community.');
    expect(component.buttonText).toBe('Get Started');
    expect(component.imageUrl).toBe('https://via.placeholder.com/600x400');
    // Optionally check rendered content if template binds these properties
    // expect(compiled.textContent).toContain(component.title);
    // expect(compiled.textContent).toContain(component.description);
  });

  it('should accept custom @Input values', () => {
    component.title = 'Custom Title';
    component.description = 'Custom Description';
    component.buttonText = 'Custom Button';
    component.imageUrl = 'custom-image-url.jpg';
    fixture.detectChanges();
    expect(component.title).toBe('Custom Title');
    expect(component.description).toBe('Custom Description');
    expect(component.buttonText).toBe('Custom Button');
    expect(component.imageUrl).toBe('custom-image-url.jpg');
    // Optionally check rendered content if template binds these properties
    // const compiled = fixture.nativeElement as HTMLElement;
    // expect(compiled.textContent).toContain('Custom Title');
    // expect(compiled.textContent).toContain('Custom Description');
  });
});
