import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'video-client'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('video-client');
  });

  it('bootstraps the electric personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('electric');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });
});
