import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('renders the topographic drift motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-topographic-drift')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('places the About This App utility in the app flow after routed content', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector(
      '.app-content'
    ) as HTMLElement;
    const utility = content.querySelector('hai-about-tag.about-app-utility');

    expect(utility).not.toBeNull();
    expect(content.lastElementChild).toBe(utility);
  });

  it('resets the shared fixed utility host into a reserved in-flow dock', () => {
    const styles = readFileSync(join(__dirname, 'app.component.scss'), 'utf8');

    expect(styles).toMatch(
      /\.app-content\s*>\s*hai-about-tag\.about-app-utility\s*\{[\s\S]*position:\s*static/
    );
    expect(styles).toMatch(
      /\.app-content\s*>\s*hai-about-tag\.about-app-utility\s*\{[\s\S]*left:\s*auto[\s\S]*bottom:\s*auto/
    );
  });
});
