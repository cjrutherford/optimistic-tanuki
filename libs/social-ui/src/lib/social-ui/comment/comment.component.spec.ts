import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentComponent } from './comment.component';
import { MatDialog } from '@angular/material/dialog';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;
  let dialogMock: any;
  let themeServiceMock: any;

  beforeEach(async () => {
    dialogMock = {
      open: jest.fn(),
      closeAll: jest.fn(),
    };

    themeServiceMock = {
      themeColors$: of({ // Mock a default theme
        background: '#ffffff',
        foreground: '#333333',
        accent: '#000000',
        accentShades: [['0', '#000'], ['1', '#111'], ['2', '#222'], ['3', '#333'], ['4', '#444'], ['5', '#555'], ['6', '#666'], ['7', '#777'], ['8', '#888'], ['9', '#999']],
        accentGradients: { light: 'light-accent-gradient', dark: 'dark-accent-gradient', fastCycle: 'fast-accent-cycle' },
        complementary: '#cccccc',
        complementaryShades: [['0', '#ccc'], ['1', '#ddd'], ['2', '#eee'], ['3', '#fff'], ['4', '#aaa'], ['5', '#bbb'], ['6', '#ccc'], ['7', '#ddd'], ['8', '#eee'], ['9', '#fff']],
        complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-complementary-cycle' },
        tertiary: '#123456',
        tertiaryShades: [['0', '#123'], ['1', '#234'], ['2', '#345'], ['3', '#456'], ['4', '#567'], ['5', '#678'], ['6', '#789'], ['7', '#89a'], ['8', '#9ab'], ['9', '#abc']],
        tertiaryGradients: { light: 'light-tertiary-gradient', dark: 'dark-tertiary-gradient', fastCycle: 'fast-tertiary-cycle' },
        success: '#00ff00',
        successShades: [['0', '#0f0'], ['1', '#1f1'], ['2', '#2f2'], ['3', '#3f3'], ['4', '#4f4'], ['5', '#5f5'], ['6', '#6f6'], ['7', '#7f7'], ['8', '#8f8'], ['9', '#9f9']],
        successGradients: { light: 'light-success-gradient', dark: 'dark-success-gradient', fastCycle: 'fast-success-cycle' },
        danger: '#ff0000',
        dangerShades: [['0', '#f00'], ['1', '#f11'], ['2', '#f22'], ['3', '#f33'], ['4', '#f44'], ['5', '#f55'], ['6', '#f66'], ['7', '#f77'], ['8', '#f88'], ['9', '#f99']],
        dangerGradients: { light: 'light-danger-gradient', dark: 'dark-danger-gradient', fastCycle: 'fast-danger-cycle' },
        warning: '#ffff00',
        warningShades: [['0', '#ff0'], ['1', '#ff1'], ['2', '#ff2'], ['3', '#ff3'], ['4', '#ff4'], ['5', '#ff5'], ['6', '#ff6'], ['7', '#ff7'], ['8', '#ff8'], ['9', '#ff9']],
        warningGradients: { light: 'light-warning-gradient', dark: 'dark-warning-gradient', fastCycle: 'fast-warning-cycle' },
      } as ThemeColors),
      setTheme: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommentComponent],
      providers: [
        { provide: MatDialog, useValue: dialogMock },
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the comment dialog', () => {
    component.openCommentDialog();
    expect(dialogMock.closeAll).toHaveBeenCalled();
    expect(dialogMock.open).toHaveBeenCalledWith(component.commentDialog);
  });

  it('should emit comment and close dialog on onSubmit', () => {
    jest.spyOn(component.commentAdded, 'emit');
    component.comment = 'Test comment';
    component.onSubmit();
    expect(component.commentAdded.emit).toHaveBeenCalledWith('Test comment');
    expect(component.comment).toBe('');
    expect(dialogMock.closeAll).toHaveBeenCalled();
  });

  it('should clear comment and close dialog on onCancel', () => {
    component.comment = 'Test comment';
    component.onCancel();
    expect(component.comment).toBe('');
    expect(dialogMock.closeAll).toHaveBeenCalled();
  });

  it('should apply theme correctly for dark theme', () => {
    const colors = {
      background: '#ffffff',
      foreground: '#333333',
      accent: '#000000',
      accentShades: [['0', '#000'], ['1', '#111'], ['2', '#222'], ['3', '#333'], ['4', '#444'], ['5', '#555'], ['6', '#666'], ['7', '#777'], ['8', '#888'], ['9', '#999']],
      accentGradients: { light: 'light-accent-gradient', dark: 'dark-accent-gradient', fastCycle: 'fast-accent-cycle' },
      complementary: '#cccccc',
      complementaryShades: [['0', '#ccc'], ['1', '#ddd'], ['2', '#eee'], ['3', '#fff'], ['4', '#aaa'], ['5', '#bbb'], ['6', '#ccc'], ['7', '#ddd'], ['8', '#eee'], ['9', '#fff']],
      complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-complementary-cycle' },
      tertiary: '#123456',
      tertiaryShades: [['0', '#123'], ['1', '#234'], ['2', '#345'], ['3', '#456'], ['4', '#567'], ['5', '#678'], ['6', '#789'], ['7', '#89a'], ['8', '#9ab'], ['9', '#abc']],
      tertiaryGradients: { light: 'light-tertiary-gradient', dark: 'dark-tertiary-gradient', fastCycle: 'fast-tertiary-cycle' },
      success: '#00ff00',
      successShades: [['0', '#0f0'], ['1', '#1f1'], ['2', '#2f2'], ['3', '#3f3'], ['4', '#4f4'], ['5', '#5f5'], ['6', '#6f6'], ['7', '#7f7'], ['8', '#8f8'], ['9', '#9f9']],
      successGradients: { light: 'light-success-gradient', dark: 'dark-success-gradient', fastCycle: 'fast-success-cycle' },
      danger: '#ff0000',
      dangerShades: [['0', '#f00'], ['1', '#f11'], ['2', '#f22'], ['3', '#f33'], ['4', '#f44'], ['5', '#f55'], ['6', '#f66'], ['7', '#f77'], ['8', '#f88'], ['9', '#f99']],
      dangerGradients: { light: 'light-danger-gradient', dark: 'dark-danger-gradient', fastCycle: 'fast-danger-cycle' },
      warning: '#ffff00',
      warningShades: [['0', '#ff0'], ['1', '#ff1'], ['2', '#ff2'], ['3', '#ff3'], ['4', '#ff4'], ['5', '#ff5'], ['6', '#ff6'], ['7', '#ff7'], ['8', '#ff8'], ['9', '#ff9']],
      warningGradients: { light: 'light-warning-gradient', dark: 'dark-warning-gradient', fastCycle: 'fast-warning-cycle' },
    } as ThemeColors;
    component.applyTheme(colors);
    expect(component.background).toBe(`linear-gradient(30deg, ${colors.accent}, ${colors.background})`);
    expect(component.accent).toBe(colors.accent);
    expect(component.borderColor).toBe(colors.complementary);
    expect(component.borderGradient).toBe(colors.complementaryGradients['dark']);
    expect(component.accentShade).toBe(colors.accentShades[6][1]);
    expect(component.foreground).toBe(colors.foreground);
    expect(component.complement).toBe(colors.complementary);
    expect(component.transitionDuration).toBe('0.5s');
  });

  it('should apply theme correctly for light theme', () => {
    component.theme = 'light';
    const colors = {
      background: '#ffffff',
      foreground: '#333333',
      accent: '#000000',
      accentShades: [['0', '#000'], ['1', '#111'], ['2', '#222'], ['3', '#333'], ['4', '#444'], ['5', '#555'], ['6', '#666'], ['7', '#777'], ['8', '#888'], ['9', '#999']],
      accentGradients: { light: 'light-accent-gradient', dark: 'dark-accent-gradient', fastCycle: 'fast-accent-cycle' },
      complementary: '#cccccc',
      complementaryShades: [['0', '#ccc'], ['1', '#ddd'], ['2', '#eee'], ['3', '#fff'], ['4', '#aaa'], ['5', '#bbb'], ['6', '#ccc'], ['7', '#ddd'], ['8', '#eee'], ['9', '#fff']],
      complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-complementary-cycle' },
      tertiary: '#123456',
      tertiaryShades: [['0', '#123'], ['1', '#234'], ['2', '#345'], ['3', '#456'], ['4', '#567'], ['5', '#678'], ['6', '#789'], ['7', '#89a'], ['8', '#9ab'], ['9', '#abc']],
      tertiaryGradients: { light: 'light-tertiary-gradient', dark: 'dark-tertiary-gradient', fastCycle: 'fast-tertiary-cycle' },
      success: '#00ff00',
      successShades: [['0', '#0f0'], ['1', '#1f1'], ['2', '#2f2'], ['3', '#3f3'], ['4', '#4f4'], ['5', '#5f5'], ['6', '#6f6'], ['7', '#7f7'], ['8', '#8f8'], ['9', '#9f9']],
      successGradients: { light: 'light-success-gradient', dark: 'dark-success-gradient', fastCycle: 'fast-success-cycle' },
      danger: '#ff0000',
      dangerShades: [['0', '#f00'], ['1', '#f11'], ['2', '#f22'], ['3', '#f33'], ['4', '#f44'], ['5', '#f55'], ['6', '#f66'], ['7', '#f77'], ['8', '#f88'], ['9', '#f99']],
      dangerGradients: { light: 'light-danger-gradient', dark: 'dark-danger-gradient', fastCycle: 'fast-danger-cycle' },
      warning: '#ffff00',
      warningShades: [['0', '#ff0'], ['1', '#ff1'], ['2', '#ff2'], ['3', '#ff3'], ['4', '#ff4'], ['5', '#ff5'], ['6', '#ff6'], ['7', '#ff7'], ['8', '#ff8'], ['9', '#ff9']],
      warningGradients: { light: 'light-warning-gradient', dark: 'dark-warning-gradient', fastCycle: 'fast-warning-cycle' },
    } as ThemeColors;
    component.applyTheme(colors);
    expect(component.background).toBe(`linear-gradient(30deg, ${colors.accent}, ${colors.background})`);
    expect(component.accent).toBe(colors.accent);
    expect(component.borderColor).toBe(colors.complementary);
    expect(component.borderGradient).toBe(colors.complementaryGradients['light']);
    expect(component.accentShade).toBe(colors.accentShades[2][1]);
    expect(component.foreground).toBe(colors.foreground);
    expect(component.complement).toBe(colors.complementary);
    expect(component.transitionDuration).toBe('0.5s');
  });
});