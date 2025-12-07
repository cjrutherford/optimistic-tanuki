import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('SpinnerComponent', () => {
  let component: SpinnerComponent;
  let fixture: ComponentFixture<SpinnerComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
      providers: [ThemeService],
    }).compileComponents();
    fixture = TestBed.createComponent(SpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply theme colors via applyTheme by setting CSS variables on the element', () => {
    const mockColors = {
      accent: '#123',
      foreground: '#abc',
      background: '#def',
      complementary: '#456',
    } as any;
    component.applyTheme(mockColors);
    
    const nativeElement = fixture.nativeElement;
    expect(nativeElement.style.getPropertyValue('--local-accent')).toBe('#123');
    expect(nativeElement.style.getPropertyValue('--local-foreground')).toBe('#abc');
    expect(nativeElement.style.getPropertyValue('--local-background')).toBe('#def');
    expect(nativeElement.style.getPropertyValue('--local-complement')).toBe('#456');
  });

  it('should set styleType and size', () => {
    component.styleType = 'circle';
    component.size = '48px';
    expect(component.styleType).toBe('circle');
    expect(component.size).toBe('48px');
  });

});
