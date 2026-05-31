import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'store-client'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('store-client');
  });

  it('bootstraps the playful personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('playful');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });

  it('renders the aurora ribbon motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-aurora-ribbon')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });
});
