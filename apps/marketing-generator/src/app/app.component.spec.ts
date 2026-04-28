import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('AppComponent', () => {
  it('initializes the shared personality theme in the browser', async () => {
    const themeServiceStub = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ThemeService, useValue: themeServiceStub },
      ],
    }).compileComponents();

    TestBed.createComponent(AppComponent);

    expect(themeServiceStub.setTheme).toHaveBeenCalled();
    expect(themeServiceStub.setPersonality).toHaveBeenCalled();
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalled();
  });
});
