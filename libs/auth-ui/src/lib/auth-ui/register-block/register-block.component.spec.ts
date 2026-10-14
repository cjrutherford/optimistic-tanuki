import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterBlockComponent } from './register-block.component';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { OAuthButtonsComponent } from '../oauth-buttons/oauth-buttons.component';

describe('RegisterBlockComponent', () => {
  let component: RegisterBlockComponent;
  let fixture: ComponentFixture<RegisterBlockComponent>;
  let themeServiceMock: any;

  beforeEach(async () => {
    themeServiceMock = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#333333',
        accent: '#000000',
        accentShades: [
          ['0', '#000'],
          ['1', '#111'],
          ['2', '#222'],
          ['3', '#333'],
          ['4', '#444'],
          ['5', '#555'],
          ['6', '#666'],
          ['7', '#777'],
          ['8', '#888'],
          ['9', '#999'],
        ],
        accentGradients: {
          light: 'light-accent-gradient',
          dark: 'dark-accent-gradient',
          fastCycle: 'fast-accent-cycle',
        },
        complementary: '#cccccc',
        complementaryShades: [
          ['0', '#ccc'],
          ['1', '#ddd'],
          ['2', '#eee'],
          ['3', '#fff'],
          ['4', '#aaa'],
          ['5', '#bbb'],
          ['6', '#ccc'],
          ['7', '#ddd'],
          ['8', '#eee'],
          ['9', '#fff'],
        ],
        complementaryGradients: {
          dark: 'dark-gradient',
          light: 'light-gradient',
          fastCycle: 'fast-complementary-cycle',
        },
        tertiary: '#123456',
        tertiaryShades: [
          ['0', '#123'],
          ['1', '#234'],
          ['2', '#345'],
          ['3', '#456'],
          ['4', '#567'],
          ['5', '#678'],
          ['6', '#789'],
          ['7', '#89a'],
          ['8', '#9ab'],
          ['9', '#abc'],
        ],
        tertiaryGradients: {
          light: 'light-tertiary-gradient',
          dark: 'dark-tertiary-gradient',
          fastCycle: 'fast-tertiary-cycle',
        },
        success: '#00ff00',
        successShades: [
          ['0', '#0f0'],
          ['1', '#1f1'],
          ['2', '#2f2'],
          ['3', '#3f3'],
          ['4', '#4f4'],
          ['5', '#5f5'],
          ['6', '#6f6'],
          ['7', '#7f7'],
          ['8', '#8f8'],
          ['9', '#9f9'],
        ],
        successGradients: {
          light: 'light-success-gradient',
          dark: 'dark-success-gradient',
          fastCycle: 'fast-success-cycle',
        },
        danger: '#ff0000',
        dangerShades: [
          ['0', '#f00'],
          ['1', '#f11'],
          ['2', '#f22'],
          ['3', '#f33'],
          ['4', '#f44'],
          ['5', '#f55'],
          ['6', '#f66'],
          ['7', '#f77'],
          ['8', '#f88'],
          ['9', '#f99'],
        ],
        dangerGradients: {
          light: 'light-danger-gradient',
          dark: 'dark-danger-gradient',
          fastCycle: 'fast-danger-cycle',
        },
        warning: '#ffff00',
        warningShades: [
          ['0', '#ff0'],
          ['1', '#ff1'],
          ['2', '#ff2'],
          ['3', '#ff3'],
          ['4', '#ff4'],
          ['5', '#ff5'],
          ['6', '#ff6'],
          ['7', '#ff7'],
          ['8', '#ff8'],
          ['9', '#ff9'],
        ],
        warningGradients: {
          light: 'light-warning-gradient',
          dark: 'dark-warning-gradient',
          fastCycle: 'fast-warning-cycle',
        },
      } as ThemeColors),
      getTheme: () => 'light',
    };

    await TestBed.configureTestingModule({
      imports: [RegisterBlockComponent, ReactiveFormsModule],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('collects date of birth before showing account fields', () => {
    component.ageGateEnabled = true;
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('input[type="date"]')).toBeTruthy();
    expect(root.querySelector('input[autocomplete="username"]')).toBeFalsy();
    expect(root.querySelector('input[autocomplete="new-password"]')).toBeFalsy();
  });

  it('blocks under-13 registration without emitting account data', () => {
    component.ageGateEnabled = true;
    component.registerForm.patchValue({ dateOfBirth: '2016-01-01' });
    const submit = jest.spyOn(component.submitEvent, 'emit');

    component.continueFromAge();
    fixture.detectChanges();

    expect(component.registrationStep).toBe('blocked');
    expect(fixture.nativeElement.textContent).toContain(
      'You must be at least 13 to register.'
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('collects only guardian contacts for a teen permission request', () => {
    component.ageGateEnabled = true;
    component.registerForm.patchValue({
      dateOfBirth: '2010-01-01',
      email: 'teen@example.invalid',
      guardianEmail: 'guardian@example.invalid',
    });
    const root: HTMLElement = fixture.nativeElement;

    component.continueFromAge();
    fixture.detectChanges();

    expect(component.registrationStep).toBe('guardian');
    expect(root.querySelector('input[autocomplete="new-password"]')).toBeFalsy();
    expect(root.querySelector('input[autocomplete="given-name"]')).toBeFalsy();
  });

  it('forwards adult DOB from the rendered OAuth provider button', () => {
    component.ageGateEnabled = true;
    component.registerForm.patchValue({ dateOfBirth: '1990-01-01' });
    component.registrationStep = 'adult';
    fixture.detectChanges();
    const emitted = jest.spyOn(component.oauthProviderSelected, 'emit');
    const oauthButtons = fixture.debugElement.query(
      By.directive(OAuthButtonsComponent)
    ).componentInstance as OAuthButtonsComponent;

    oauthButtons.onProviderClick('google');

    expect(emitted).toHaveBeenCalledWith({
      provider: 'google',
      dateOfBirth: '1990-01-01',
      guardianResumeToken: undefined,
    });
  });

  it('forwards a resumed teen token from the rendered OAuth provider button', () => {
    component.ageGateEnabled = true;
    component.guardianResumeToken = 'resume-secret';
    component.registerForm.patchValue({ dateOfBirth: '2010-01-01' });
    component.registrationStep = 'adult';
    fixture.detectChanges();
    const emitted = jest.spyOn(component.oauthProviderSelected, 'emit');
    const oauthButtons = fixture.debugElement.query(
      By.directive(OAuthButtonsComponent)
    ).componentInstance as OAuthButtonsComponent;

    oauthButtons.onProviderClick('google');

    expect(emitted).toHaveBeenCalledWith({
      provider: 'google',
      dateOfBirth: '2010-01-01',
      guardianResumeToken: 'resume-secret',
    });
  });

  it('does not add age data to OAuth initiation for apps that do not enable the age gate', () => {
    component.registerForm.patchValue({ dateOfBirth: '2010-01-01' });
    component.guardianResumeToken = 'unrelated-secret';
    const emitted = jest.spyOn(component.oauthProviderSelected, 'emit');

    component.onOAuthProvider({ provider: 'google' });

    expect(emitted).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('should apply dark theme colors when theme is dark', () => {
    themeServiceMock.getTheme = () => 'dark';
    component.ngOnInit();
    fixture.detectChanges();
    expect(component.borderGradient).toBe('dark-gradient');
  });

  it('should apply light theme colors when theme is not dark', () => {
    themeServiceMock.getTheme = () => 'light';
    component.ngOnInit();
    fixture.detectChanges();
    expect(component.borderGradient).toBe('light-gradient');
  });

  it('should emit submitEvent on onSubmit', () => {
    jest.spyOn(component.submitEvent, 'emit');
    component.registerForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password',
      confirmation: 'password',
      bio: 'A test user',
      dateOfBirth: '',
      guardianEmail: '',
    });
    component.onSubmit();
    expect(component.submitEvent.emit).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password',
      confirmation: 'password',
      bio: 'A test user',
    });
  });

  it('should log onFormChange', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.onFormChange('test');
    expect(consoleSpy).toHaveBeenCalledWith('test');
  });
});
