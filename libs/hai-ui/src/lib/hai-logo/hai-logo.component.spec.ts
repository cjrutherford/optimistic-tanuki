import { Component } from '@angular/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { HaiLogoComponent } from './hai-logo.component';

@Component({
  standalone: true,
  imports: [HaiLogoComponent],
  template: `<hai-logo id="a" /><hai-logo id="b" label="HAI" />`,
})
class HostComponent {}

describe('HaiLogoComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an inline svg with the mark and wordmark', () => {
    const svg = render().querySelector('#a svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('10 10 296 254');
    expect(svg?.querySelectorAll('.hai-logo-bright').length).toBe(2);
    expect(svg?.querySelectorAll('.hai-logo-deep').length).toBe(3);
  });

  it('gives every instance its own clip ids', () => {
    const root = render();
    const ids = Array.from(root.querySelectorAll('clipPath')).map((c) => c.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    for (const el of Array.from(root.querySelectorAll('[clip-path]'))) {
      const ref = el.getAttribute('clip-path')?.slice(5, -1) ?? '';
      expect(ids).toContain(ref.replace('#', ''));
    }
  });

  it('is decorative by default', () => {
    const svg = render().querySelector('#a svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.hasAttribute('aria-label')).toBe(false);
  });

  it('uses the label when given', () => {
    const svg = render().querySelector('#b svg');
    expect(svg?.getAttribute('aria-label')).toBe('HAI');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
  });

  // Jest does not apply component styles, so the shade rules are checked in
  // the stylesheet source; the rendered colours are measured in a browser.
  describe('shade rules', () => {
    const scss = readFileSync(
      join(__dirname, 'hai-logo.component.scss'),
      'utf8'
    ).replace(/\s+/g, ' ');

    it('fills deep and bright parts from the resolved shade variables', () => {
      expect(scss).toContain('.hai-logo-deep { fill: var(--_hai-logo-deep);');
      expect(scss).toContain(
        '.hai-logo-bright { fill: var(--_hai-logo-bright);'
      );
    });

    it('shades deep with primary-text and bright with primary in light mode', () => {
      expect(scss).toContain(':host { display: inline-block;');
      expect(scss).toMatch(
        /--_hai-logo-deep: var\(--hai-logo-deep, var\(--primary-text, var\(--primary\)\)\);/
      );
      expect(scss).toContain(
        '--_hai-logo-bright: var(--hai-logo-bright, var(--primary));'
      );
    });

    it('swaps the roles in dark mode, keyed off the data-theme attribute', () => {
      const dark = scss.slice(
        scss.indexOf(":host-context(html[data-theme='dark'])")
      );
      expect(dark).toContain(":host-context(html[data-theme='dark'])");
      expect(dark).toMatch(
        /--_hai-logo-deep: var\( ?--hai-logo-deep, color-mix\(in srgb, var\(--primary\) 75%, var\(--primary-text, var\(--primary\)\)\)/
      );
      expect(dark).toMatch(
        /--_hai-logo-bright: var\( ?--hai-logo-bright, var\(--primary-text, var\(--primary\)\)/
      );
    });

    it('lets the --hai-logo overrides win in both modes', () => {
      expect(scss.match(/var\( ?--hai-logo-deep,/g)).toHaveLength(2);
      expect(scss.match(/var\( ?--hai-logo-bright,/g)).toHaveLength(2);
    });

    it('hard-codes no colour', () => {
      expect(scss).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    });
  });
});
