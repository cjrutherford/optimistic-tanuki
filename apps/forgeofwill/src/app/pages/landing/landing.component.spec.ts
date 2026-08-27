import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            themeColors$: of(undefined),
            getTheme: jest.fn(() => 'light'),
            generatedTheme$: of(undefined),
            getHeaderGradient: jest.fn(() => 'linear-gradient(#000, #111)'),
            getButtonGradient: jest.fn(() => 'linear-gradient(#111, #222)'),
            generatedTheme: {
              getValue: () => undefined,
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the marketing proof band for the landing workflow', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-proof-band')).toBeTruthy();
    expect(compiled.textContent).toContain('From plan to progress');
  });

  it('keeps decorative forge layers out of the accessibility tree and avoids unsupported AI claims', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      compiled.querySelector('.forge-background')?.getAttribute('aria-hidden')
    ).toBe('true');
    expect(compiled.textContent).not.toContain('AI assistance');
    expect(compiled.textContent).not.toContain('Use AI where it helps');
  });

  it('uses semantic light and dark stat colors instead of raw literals', () => {
    const styles = readFileSync(
      join(__dirname, 'landing.component.scss'),
      'utf8'
    );

    expect(styles).toMatch(
      /--forge-stat-value:\s*color-mix\(\s*in srgb,\s*var\(--foreground\) 90%,\s*var\(--background\)\s*\)/
    );
    expect(styles).toMatch(
      /:host-context\(html\[data-mode=['"]dark['"]\]\)[\s\S]*--forge-stat-value:\s*var\(--foreground\)/
    );

    const contrast = (foreground: number[], background: number[]) => {
      const luminance = (color: number[]) => {
        const linear = color.map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const [lighter, darker] = [
        luminance(foreground),
        luminance(background),
      ].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };

    // These representative runtime surfaces include the low-contrast light
    // personality state that previously exposed the `var(--foreground)` bug.
    expect(contrast([23, 32, 51], [243, 250, 253])).toBeGreaterThanOrEqual(4.5);
    expect(contrast([248, 250, 252], [10, 10, 15])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps Forge muted normal text at least 4.5:1 in representative light and dark themes', () => {
    const styles = readFileSync(
      join(__dirname, 'landing.component.scss'),
      'utf8'
    );
    const mix = (foreground: number[], background: number[]) =>
      foreground.map((channel, index) =>
        Math.round(channel * 0.8 + background[index] * 0.2)
      );
    const luminance = (color: number[]) => {
      const linear = color.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrast = (first: number[], second: number[]) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort(
        (a, b) => b - a
      );
      return (lighter + 0.05) / (darker + 0.05);
    };

    expect(styles).toMatch(
      /--forge-readable-muted:\s*color-mix\(\s*in srgb,\s*var\(--foreground\) 80%,\s*var\(--background\)\s*\)/
    );
    expect(
      contrast(mix([15, 23, 42], [255, 255, 255]), [255, 255, 255])
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(mix([240, 240, 245], [10, 10, 15]), [10, 10, 15])
    ).toBeGreaterThanOrEqual(4.5);
  });
});
