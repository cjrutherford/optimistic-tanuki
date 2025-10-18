import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroSectionComponent } from './hero-section.component';

describe('HeroSectionComponent', () => {
  let component: HeroSectionComponent;
  let fixture: ComponentFixture<HeroSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default values', () => {
    expect(component.overlayOpacity).toBe(0.4);
    expect(component.overlayColor).toBe('#000000');
    expect(component.minHeight).toBe('60vh');
    expect(component.centerContent).toBe(true);
  });

  it('should accept custom values', () => {
    component.overlayOpacity = 0.6;
    component.overlayColor = '#ffffff';
    component.minHeight = '80vh';
    component.centerContent = false;
    
    expect(component.overlayOpacity).toBe(0.6);
    expect(component.overlayColor).toBe('#ffffff');
    expect(component.minHeight).toBe('80vh');
    expect(component.centerContent).toBe(false);
  });
});
