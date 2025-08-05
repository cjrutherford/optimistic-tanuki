import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';
import { ThemeService } from '@optimistic-tanuki/theme-ui';

describe('CardComponent', () => {
  let component: CardComponent;
  let fixture: ComponentFixture<CardComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardComponent],
      providers: [ThemeService]
    }).compileComponents();

    fixture = TestBed.createComponent(CardComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark theme colors when theme is dark', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      accentShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
      complementaryShades: [[null, '#ddd'], [null, '#eee'], [null, '#fff']],
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
    } as any;

    component.theme = 'dark';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(to bottom, ${mockColors.background}, ${mockColors.accent})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.accentGradients.dark);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][0]);
  });

  it('should apply light theme colors when theme is light', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      accentShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
      complementaryShades: [[null, '#ddd'], [null, '#eee'], [null, '#fff']],
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(to bottom, ${mockColors.background}, ${mockColors.accent})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.accentGradients.light);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);
  });
});
