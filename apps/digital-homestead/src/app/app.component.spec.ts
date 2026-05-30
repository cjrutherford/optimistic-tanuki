import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ContactService } from './contact.service';
import { of } from 'rxjs';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterModule.forRoot([]),
        HttpClientTestingModule,
      ],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ContactService,
          useValue: {
            postContact: jest.fn(() => of({})),
          },
        },
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('otui-heading')?.textContent).toContain(
      'Digital Grange'
    );
  });

  it(`should have as title 'digital-homestead'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('digital-homestead');
  });

  it('renders the glass fog motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-glass-fog')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('bootstraps the soft-touch personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('soft-touch');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });
});
