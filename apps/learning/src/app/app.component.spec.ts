import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  function configure(platform: 'browser' | 'server') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
  }

  it('hosts route content', () => {
    configure('browser');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('bootstraps the architect personality', () => {
    configure('browser');
    const theme = TestBed.inject(ThemeService);
    const setPersonality = jest.spyOn(theme, 'setPersonality');

    TestBed.createComponent(AppComponent).detectChanges();

    expect(setPersonality).toHaveBeenCalledWith('architect');
  });

  // Touching the theme on the server would reach for document during SSR.
  it('leaves the theme alone when rendering on the server', () => {
    configure('server');
    const theme = TestBed.inject(ThemeService);
    const setPersonality = jest.spyOn(theme, 'setPersonality');

    TestBed.createComponent(AppComponent).detectChanges();

    expect(setPersonality).not.toHaveBeenCalled();
  });
});
