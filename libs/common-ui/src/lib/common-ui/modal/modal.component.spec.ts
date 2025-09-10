import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';
import { ThemeService } from '@optimistic-tanuki/theme-ui';

describe('ModalComponent', () => {
  let component: ModalComponent;
  let fixture: ComponentFixture<ModalComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent],
      providers: [ThemeService]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
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
      complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient' },
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
      complementaryShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
    } as any;

    component.theme = 'dark';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(30deg, ${mockColors.accent}, ${mockColors.background})`);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.borderColor).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.complementaryGradients.dark);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.complement).toBe(mockColors.complementary);
  });

  it('should apply light theme colors when theme is light', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient' },
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
      complementaryShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(30deg, ${mockColors.accent}, ${mockColors.background})`);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.borderColor).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.complementaryGradients.light);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.complement).toBe(mockColors.complementary);
  });

  it('should emit closeModal event on onClose', () => {
    jest.spyOn(component.closeModal, 'emit');
    component.onClose();
    expect(component.closeModal.emit).toHaveBeenCalled();
  });
});
