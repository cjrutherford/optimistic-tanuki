import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have title property', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app['title']).toBe('owner-console');
  });

  it('should render router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('bootstraps the control-center personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('control-center');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });

  it('renders the signal mesh motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-signal-mesh')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });
});
